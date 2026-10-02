import { useCallback, useEffect, useRef, useState } from 'react'
import { CHARACTERS, CHARACTER_BY_ID, CHARACTER_IDS, DEFAULT_CHARACTER_ID, nextRosterCharacter, weatherForLevel } from '../EdgeBrake/characters'
import { chargePowerForMs, slideDecelerationFor } from '../EdgeBrake/physics'
import { evaluateStop } from '../EdgeBrake/rules'
import { CHARACTER_FRONT, type CharacterId, type GamePhase, type RoundResult, type ViewState } from '../EdgeBrake/types'
import { playSound } from '../EdgeBrake/utils/sounds'
import {
  SAVE_KEYS,
  advanceContracts,
  campLevel,
  stipendForRank,
  loadMeta,
  quoteUpgrade,
  resetRunContracts,
  saveMeta,
  studMultiplier,
  type GuestMeta,
  type UpgradeId,
} from './meta'
import { hintedLaunchSpeed } from './recommend'

const START_X = 40
const STOP_HOLD_MS = 140
const FALL_MS = 1250
const SUCCESS_MS = 1550
const EARLY_FAIL_MS = 1450
const AUTO_BRAKE_STOP_TIME = 1.8
const AUTO_BRAKE_CLIFF_TIME = 1.3

function randomCliff() {
  return 1820 + Math.round(Math.random() * 120)
}

function readNumber(key: string, fallback: number) {
  const value = Number(localStorage.getItem(key))
  return Number.isFinite(value) ? value : fallback
}

function readUnlocked(): CharacterId[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVE_KEYS.unlocked) || '[]')
    const valid = Array.isArray(parsed) ? parsed.filter((id): id is CharacterId => CHARACTER_IDS.includes(id)) : []
    return Array.from(new Set<CharacterId>([DEFAULT_CHARACTER_ID, ...valid]))
  } catch {
    return [DEFAULT_CHARACTER_ID]
  }
}

function readCharacter(unlocked: CharacterId[]): CharacterId {
  const saved = localStorage.getItem(SAVE_KEYS.character) as CharacterId | null
  return saved && unlocked.includes(saved) ? saved : DEFAULT_CHARACTER_ID
}

function saveCollection(coins: number, unlocked: CharacterId[], characterId: CharacterId, maxLevel: number) {
  localStorage.setItem(SAVE_KEYS.coins, String(coins))
  localStorage.setItem(SAVE_KEYS.unlocked, JSON.stringify(unlocked))
  localStorage.setItem(SAVE_KEYS.character, characterId)
  localStorage.setItem(SAVE_KEYS.maxLevel, String(maxLevel))
}

function bootMeta() {
  const next = resetRunContracts(loadMeta())
  saveMeta(next)
  return next
}

function initialState(): ViewState {
  const unlockedCharacters = readUnlocked()
  return {
    phase: 'cover',
    x: START_X,
    velocity: 0,
    cliffX: 1880,
    isCharging: false,
    isAutoBraking: false,
    chargePower: 0,
    score: 0,
    level: 1,
    combo: 0,
    bestCombo: readNumber(SAVE_KEYS.bestCombo, 0),
    bestDistance: localStorage.getItem(SAVE_KEYS.bestDistance) === null ? null : readNumber(SAVE_KEYS.bestDistance, 0),
    bestScore: readNumber(SAVE_KEYS.bestScore, 0),
    coins: readNumber(SAVE_KEYS.coins, 0),
    runCoins: 0,
    maxLevel: readNumber(SAVE_KEYS.maxLevel, 1),
    characterId: readCharacter(unlockedCharacters),
    unlockedCharacters,
    newUnlock: null,
    result: null,
    eventKey: 0,
    muted: localStorage.getItem(SAVE_KEYS.muted) === '1',
  }
}

export function canShop(phase: GamePhase) {
  return phase === 'cover' || phase === 'awaiting' || phase === 'result' || phase === 'gameover'
}

export interface GrowthNote {
  xp: number
  camp: number
  rankedUp: boolean
  stipend: number
}

export function useGuestBrake() {
  const [view, setView] = useState<ViewState>(initialState)
  const [meta, setMeta] = useState<GuestMeta>(bootMeta)
  const [banner, setBanner] = useState<string | null>(null)
  const [growth, setGrowth] = useState<GrowthNote | null>(null)
  const stateRef = useRef(view)
  const metaRef = useRef(meta)
  const locksRef = useRef({ tutorial: false, roster: false })
  const rafRef = useRef(0)
  const loopGenerationRef = useRef(0)
  const lastTsRef = useRef(0)
  const chargeStartedAtRef = useRef(0)
  const highChargeCueRef = useRef(false)
  const stopSinceRef = useRef<number | null>(null)
  const fallTimerRef = useRef<number | null>(null)
  const successTimerRef = useRef<number | null>(null)
  const earlyFailTimerRef = useRef<number | null>(null)
  const unlockTimerRef = useRef<number | null>(null)
  const bannerTimerRef = useRef<number | null>(null)
  const inputUnlockAtRef = useRef(0)

  const commit = useCallback((next: ViewState | ((current: ViewState) => ViewState)) => {
    const value = typeof next === 'function' ? next(stateRef.current) : next
    stateRef.current = value
    setView(value)
  }, [])

  const commitMeta = useCallback((next: GuestMeta) => {
    metaRef.current = next
    saveMeta(next)
    setMeta(next)
  }, [])

  const showBanner = useCallback((text: string) => {
    if (bannerTimerRef.current !== null) window.clearTimeout(bannerTimerRef.current)
    setBanner(text)
    bannerTimerRef.current = window.setTimeout(() => {
      setBanner(null)
      bannerTimerRef.current = null
    }, 3400)
  }, [])

  const clearTimers = useCallback(() => {
    if (fallTimerRef.current !== null) window.clearTimeout(fallTimerRef.current)
    if (successTimerRef.current !== null) window.clearTimeout(successTimerRef.current)
    if (earlyFailTimerRef.current !== null) window.clearTimeout(earlyFailTimerRef.current)
    if (unlockTimerRef.current !== null) window.clearTimeout(unlockTimerRef.current)
    fallTimerRef.current = null
    successTimerRef.current = null
    earlyFailTimerRef.current = null
    unlockTimerRef.current = null
  }, [])

  const seedFor = useCallback((crewCount: number, level: number) => (id: string) => {
    if (id === 'crew5') return crewCount
    if (id === 'level8') return level
    return 0
  }, [])

  const applyMetaEvent = useCallback((
    read: (id: string, prev: number) => number,
    crewCount: number,
    level: number,
    stopXp = 0,
    runClears = metaRef.current.runClears,
    runStreak = metaRef.current.runStreak,
  ) => {
    const beforeLevel = campLevel(metaRef.current.xp)
    const updated = advanceContracts(metaRef.current, read, seedFor(crewCount, level))
    const nextMeta: GuestMeta = {
      ...updated.meta,
      xp: updated.meta.xp + stopXp,
      runClears,
      runStreak,
    }
    const afterLevel = campLevel(nextMeta.xp)
    let stipend = 0
    for (let level = beforeLevel + 1; level <= afterLevel; level += 1) stipend += stipendForRank(level)
    const xpGained = Math.max(0, nextMeta.xp - metaRef.current.xp)
    commitMeta(nextMeta)
    if (xpGained > 0 || stipend > 0) {
      setGrowth({ xp: xpGained, camp: afterLevel, rankedUp: afterLevel > beforeLevel, stipend })
    }
    const parts: string[] = []
    if (afterLevel > beforeLevel) parts.push(`CAMP ${afterLevel} · +${stipend} COINS`)
    if (updated.completed.length > 0) parts.push(`CONTRACT CLEARED · ${updated.completed.map(contract => contract.title).join(' · ')}`)
    if (parts.length > 0) {
      showBanner(parts.join(' · '))
      playSound('unlock', stateRef.current.muted)
    }
    return { bonusCoins: updated.bonusCoins + stipend, meta: nextMeta }
  }, [commitMeta, seedFor, showBanner])

  const beginRound = useCallback((level: number, characterId?: CharacterId, unlockedOverride?: CharacterId[], newUnlock: CharacterId | null = null) => {
    stopSinceRef.current = null
    highChargeCueRef.current = false
    const current = stateRef.current
    const unlocked = unlockedOverride ?? [...current.unlockedCharacters]
    const nextCharacterId = characterId && unlocked.includes(characterId) ? characterId : current.characterId
    const maxLevel = Math.max(current.maxLevel, level)
    inputUnlockAtRef.current = performance.now() + 240
    const { bonusCoins } = applyMetaEvent(
      (id, prev) => (id === 'level8' ? Math.max(prev, level) : id === 'crew5' ? Math.max(prev, unlocked.length) : prev),
      unlocked.length,
      level,
    )
    const coins = current.coins + bonusCoins
    saveCollection(coins, unlocked, nextCharacterId, maxLevel)
    commit({
      ...stateRef.current,
      phase: 'awaiting',
      x: START_X,
      velocity: 0,
      cliffX: randomCliff(),
      level,
      maxLevel,
      coins,
      runCoins: current.runCoins + bonusCoins,
      characterId: nextCharacterId,
      unlockedCharacters: unlocked,
      newUnlock,
      isCharging: false,
      isAutoBraking: false,
      chargePower: 0,
      result: null,
      eventKey: stateRef.current.eventKey + 1,
    })
    if (level > 1) {
      const weather = weatherForLevel(level)
      if (weather === 'snow') playSound('weatherSnow', current.muted)
      if (weather === 'fog') playSound('weatherFog', current.muted)
      if (weather === 'blizzard') playSound('weatherBlizzard', current.muted)
    }
    if (newUnlock) {
      playSound('unlock', current.muted)
      unlockTimerRef.current = window.setTimeout(() => commit(now => ({ ...now, newUnlock: null })), 1700)
    }
  }, [applyMetaEvent, commit])

  const startNewRunMeta = useCallback(() => {
    commitMeta(resetRunContracts(metaRef.current))
  }, [commitMeta])

  const beginCharge = useCallback(() => {
    const current = stateRef.current
    if (locksRef.current.tutorial || locksRef.current.roster) return
    if ((current.phase !== 'cover' && current.phase !== 'awaiting') || performance.now() < inputUnlockAtRef.current) return
    clearTimers()
    const fromCover = current.phase === 'cover'
    if (fromCover) startNewRunMeta()
    const base = fromCover
      ? { ...initialState(), muted: current.muted, cliffX: randomCliff(), eventKey: current.eventKey }
      : current
    chargeStartedAtRef.current = performance.now()
    highChargeCueRef.current = false
    stopSinceRef.current = null
    playSound('charge', base.muted)
    commit({
      ...base,
      phase: 'charging',
      x: START_X,
      velocity: 0,
      newUnlock: null,
      isCharging: true,
      isAutoBraking: false,
      chargePower: chargePowerForMs(0),
      result: null,
      eventKey: base.eventKey + 1,
    })
  }, [clearTimers, commit, startNewRunMeta])

  const releaseCharge = useCallback(() => {
    const current = stateRef.current
    if (current.phase !== 'charging') return
    const power = chargePowerForMs(performance.now() - chargeStartedAtRef.current)
    const velocity = hintedLaunchSpeed(CHARACTER_BY_ID[current.characterId], power, metaRef.current.springs)
    lastTsRef.current = performance.now()
    playSound('launch', current.muted, power)
    commit({
      ...current,
      phase: 'playing',
      velocity,
      isCharging: false,
      isAutoBraking: false,
      chargePower: power,
      eventKey: current.eventKey + 1,
    })
  }, [commit])

  const prepareRetry = useCallback(() => {
    clearTimers()
    const current = stateRef.current
    const reset = initialState()
    startNewRunMeta()
    inputUnlockAtRef.current = performance.now() + 240
    stopSinceRef.current = null
    highChargeCueRef.current = false
    commit({
      ...reset,
      phase: 'awaiting',
      cliffX: randomCliff(),
      muted: current.muted,
      eventKey: current.eventKey + 1,
    })
    playSound('button', current.muted)
  }, [clearTimers, commit, startNewRunMeta])

  const finishRound = useCallback((distance: number) => {
    const current = stateRef.current
    const evaluation = evaluateStop(distance, current.combo)
    const { rating, points, passed, nextCombo } = evaluation
    const earnedCoins = evaluation.coins + metaRef.current.fund
    const runClears = passed ? metaRef.current.runClears + 1 : metaRef.current.runClears
    const runStreak = passed ? metaRef.current.runStreak + 1 : 0
    const runCoins = current.runCoins + earnedCoins
    const weather = weatherForLevel(current.level)
    const crewCount = current.unlockedCharacters.length
    const stopXp = !passed ? 1 : rating === 'edge' ? 12 : rating === 'great' ? 9 : 6
    const { bonusCoins } = applyMetaEvent(
      (id, prev) => {
        if (id === 'pass1' || id === 'again') return prev + (passed ? 1 : 0)
        if (id === 'edge' || id === 'edge3') return prev + (rating === 'edge' ? 1 : 0)
        if (id === 'great2') return prev + (rating === 'edge' || rating === 'great' ? 1 : 0)
        if (id === 'fog') return prev + (passed && weather === 'fog' ? 1 : 0)
        if (id === 'blizzard') return prev + (passed && weather === 'blizzard' ? 1 : 0)
        if (id === 'snow') return prev + (passed && weather === 'snow' ? 1 : 0)
        if (id === 'clear2' || id === 'clear4') return Math.max(prev, runClears)
        if (id === 'purse' || id === 'coins40') return Math.max(prev, runCoins)
        if (id === 'streak3') return runStreak
        if (id === 'crew5') return Math.max(prev, crewCount)
        if (id === 'level8') return Math.max(prev, current.level)
        return prev
      },
      crewCount,
      current.level,
      stopXp,
      runClears,
      runStreak,
    )
    const latest = stateRef.current
    const nextScore = latest.score + points
    const nextBestScore = Math.max(latest.bestScore, nextScore)
    const nextBestCombo = Math.max(latest.bestCombo, nextCombo)
    const nextBestDistance = latest.bestDistance === null ? distance : Math.min(latest.bestDistance, distance)
    const result: RoundResult = { distance, rating, points, coins: earnedCoins + bonusCoins, passed }
    const nextCoins = latest.coins + earnedCoins + bonusCoins

    localStorage.setItem(SAVE_KEYS.bestScore, String(nextBestScore))
    localStorage.setItem(SAVE_KEYS.bestCombo, String(nextBestCombo))
    localStorage.setItem(SAVE_KEYS.bestDistance, String(nextBestDistance))
    saveCollection(nextCoins, latest.unlockedCharacters, latest.characterId, latest.maxLevel)
    playSound(rating === 'edge' ? 'edge' : rating === 'great' ? 'great' : rating === 'early' ? 'earlyFail' : 'safe', latest.muted)
    window.setTimeout(() => playSound('coin', latest.muted), 90)

    commit({
      ...latest,
      phase: passed ? 'success' : 'earlyFail',
      velocity: 0,
      isCharging: false,
      score: nextScore,
      combo: nextCombo,
      bestScore: nextBestScore,
      bestCombo: nextBestCombo,
      bestDistance: nextBestDistance,
      coins: nextCoins,
      runCoins: latest.runCoins + earnedCoins + bonusCoins,
      result,
      eventKey: latest.eventKey + 1,
    })

    if (passed) {
      successTimerRef.current = window.setTimeout(() => {
        commit(now => now.phase === 'success' ? { ...now, phase: 'result', isAutoBraking: false } : now)
        successTimerRef.current = null
      }, SUCCESS_MS)
    } else {
      earlyFailTimerRef.current = window.setTimeout(() => {
        commit(now => now.phase === 'earlyFail' ? { ...now, phase: 'result', isAutoBraking: false } : now)
        earlyFailTimerRef.current = null
      }, EARLY_FAIL_MS)
    }
  }, [applyMetaEvent, commit])

  const advanceResult = useCallback(() => {
    clearTimers()
    const current = stateRef.current
    if (current.phase !== 'result' || !current.result) return
    playSound('button', current.muted)
    if (!current.result.passed) {
      inputUnlockAtRef.current = performance.now() + 240
      commit({
        ...current,
        phase: 'awaiting',
        x: START_X,
        velocity: 0,
        cliffX: randomCliff(),
        isCharging: false,
        isAutoBraking: false,
        chargePower: 0,
        result: null,
        eventKey: current.eventKey + 1,
      })
      return
    }
    const newlyUnlocked = CHARACTERS.find(character => !current.unlockedCharacters.includes(character.id))?.id ?? null
    const unlocked = newlyUnlocked ? [...current.unlockedCharacters, newlyUnlocked] : current.unlockedCharacters
    const nextCharacterId = newlyUnlocked ?? nextRosterCharacter(current.characterId).id
    beginRound(current.level + 1, nextCharacterId, unlocked, newlyUnlocked)
  }, [beginRound, clearTimers, commit])

  const fall = useCallback(() => {
    const current = stateRef.current
    if (current.phase === 'falling' || current.phase === 'gameover') return
    playSound('fall', current.muted)
    commit({ ...current, phase: 'falling', isCharging: false, isAutoBraking: false, eventKey: current.eventKey + 1 })
    fallTimerRef.current = window.setTimeout(() => {
      commit(now => ({ ...now, phase: 'gameover', velocity: 0, isCharging: false, isAutoBraking: false }))
    }, FALL_MS)
  }, [commit])

  const tick = useCallback((ts: number) => {
    const current = stateRef.current
    const dt = Math.min((ts - lastTsRef.current) / 1000, 0.032)
    lastTsRef.current = ts

    if (current.phase === 'charging') {
      const chargePower = chargePowerForMs(ts - chargeStartedAtRef.current)
      if (!highChargeCueRef.current && chargePower >= 0.82) {
        highChargeCueRef.current = true
        playSound('powerReady', current.muted)
      }
      if (Math.abs(chargePower - current.chargePower) >= 0.002) commit({ ...current, chargePower })
      return
    }

    if (current.phase !== 'playing') return

    const character = CHARACTER_BY_ID[current.characterId]
    const deceleration = slideDecelerationFor(character, weatherForLevel(current.level)) * studMultiplier(metaRef.current.studs)
    const velocity = Math.max(0, current.velocity - deceleration * dt)
    const remainingToCliff = Math.max(0, current.cliffX - (current.x + CHARACTER_FRONT))
    const timeToCliff = remainingToCliff / Math.max(1, velocity)
    const isAutoBraking = velocity > 3 && (velocity / deceleration <= AUTO_BRAKE_STOP_TIME || timeToCliff <= AUTO_BRAKE_CLIFF_TIME)
    if (isAutoBraking && !current.isAutoBraking) playSound('autoBrake', current.muted)
    const x = current.x + (current.velocity + velocity) * 0.5 * dt
    const front = x + CHARACTER_FRONT

    if (front > current.cliffX + 12) {
      commit({ ...current, x, velocity, isAutoBraking })
      fall()
    } else if (velocity < 3) {
      if (stopSinceRef.current === null) stopSinceRef.current = ts
      commit({ ...current, x, velocity, isAutoBraking: true })
      if (ts - stopSinceRef.current >= STOP_HOLD_MS) {
        finishRound(Math.max(0, Math.round(current.cliffX - front)))
        stopSinceRef.current = null
      }
    } else {
      stopSinceRef.current = null
      commit({ ...current, x, velocity, isAutoBraking })
    }
  }, [commit, fall, finishRound])

  useEffect(() => {
    const generation = ++loopGenerationRef.current
    lastTsRef.current = performance.now()
    const frame = (ts: number) => {
      if (loopGenerationRef.current !== generation) return
      tick(ts)
      rafRef.current = requestAnimationFrame(frame)
    }
    rafRef.current = requestAnimationFrame(frame)
    return () => {
      if (loopGenerationRef.current === generation) loopGenerationRef.current += 1
      cancelAnimationFrame(rafRef.current)
    }
  }, [tick])

  const toggleMuted = useCallback(() => {
    const next = !stateRef.current.muted
    localStorage.setItem(SAVE_KEYS.muted, next ? '1' : '0')
    commit({ ...stateRef.current, muted: next })
    if (!next) playSound('button', false)
  }, [commit])

  const selectCharacter = useCallback((characterId: CharacterId) => {
    const current = stateRef.current
    if (!canShop(current.phase)) return false
    if (!current.unlockedCharacters.includes(characterId)) return false
    saveCollection(current.coins, current.unlockedCharacters, characterId, current.maxLevel)
    playSound('button', current.muted)
    commit({ ...current, characterId, eventKey: current.eventKey + 1 })
    return true
  }, [commit])

  const buyCharacter = useCallback((characterId: CharacterId) => {
    const current = stateRef.current
    if (!canShop(current.phase)) return false
    const spec = CHARACTER_BY_ID[characterId]
    if (current.unlockedCharacters.includes(characterId)) return selectCharacter(characterId)
    if (current.coins < spec.cost) {
      playSound('deny', current.muted)
      return false
    }
    const unlockedCharacters = [...current.unlockedCharacters, characterId]
    const { bonusCoins } = applyMetaEvent(
      (id, prev) => (id === 'crew5' ? Math.max(prev, unlockedCharacters.length) : prev),
      unlockedCharacters.length,
      Math.max(current.level, current.maxLevel),
    )
    const coins = current.coins - spec.cost + bonusCoins
    saveCollection(coins, unlockedCharacters, characterId, current.maxLevel)
    playSound('unlock', current.muted)
    commit({
      ...stateRef.current,
      coins,
      runCoins: current.runCoins + bonusCoins,
      unlockedCharacters,
      characterId,
      eventKey: stateRef.current.eventKey + 1,
    })
    return true
  }, [applyMetaEvent, commit, selectCharacter])

  const buyUpgrade = useCallback((id: UpgradeId) => {
    const current = stateRef.current
    if (!canShop(current.phase)) {
      playSound('deny', current.muted)
      return false
    }
    const quote = quoteUpgrade(metaRef.current, id, current.coins)
    if (!quote.ok) {
      playSound('deny', current.muted)
      return false
    }
    const nextMeta: GuestMeta = { ...metaRef.current, [id]: quote.nextRank }
    const coins = current.coins - quote.cost
    saveCollection(coins, current.unlockedCharacters, current.characterId, current.maxLevel)
    commitMeta(nextMeta)
    playSound('unlock', current.muted)
    commit({ ...current, coins, eventKey: current.eventKey + 1 })
    return true
  }, [commit, commitMeta])

  const goHome = useCallback(() => {
    clearTimers()
    startNewRunMeta()
    commit(current => ({ ...initialState(), muted: current.muted, eventKey: current.eventKey + 1 }))
  }, [clearTimers, commit, startNewRunMeta])

  const markTutorialDone = useCallback(() => {
    if (metaRef.current.tutorialDone) return
    commitMeta({ ...metaRef.current, tutorialDone: true })
  }, [commitMeta])

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if (event.repeat) return
      if (event.code === 'KeyM') {
        event.preventDefault()
        toggleMuted()
        return
      }
      if (event.code === 'KeyR') {
        if (locksRef.current.tutorial || locksRef.current.roster) return
        const phase = stateRef.current.phase
        if (phase !== 'result' && phase !== 'gameover') return
        event.preventDefault()
        if (phase === 'result') advanceResult()
        else prepareRetry()
        return
      }
      if (event.code !== 'Space' && event.code !== 'Enter') return
      event.preventDefault()
      if (locksRef.current.tutorial || locksRef.current.roster) return
      const phase = stateRef.current.phase
      if (phase === 'result') advanceResult()
      else if (phase === 'gameover') prepareRetry()
      else beginCharge()
    }
    const keyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space' && event.code !== 'Enter') return
      event.preventDefault()
      if (locksRef.current.tutorial || locksRef.current.roster) return
      releaseCharge()
    }
    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    return () => {
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('keyup', keyUp)
    }
  }, [advanceResult, beginCharge, prepareRetry, releaseCharge, toggleMuted])

  useEffect(() => () => {
    clearTimers()
    if (bannerTimerRef.current !== null) window.clearTimeout(bannerTimerRef.current)
  }, [clearTimers])

  return {
    view,
    meta,
    banner,
    growth,
    locksRef,
    camp: campLevel(meta.xp),
    beginCharge,
    releaseCharge,
    prepareRetry,
    advanceResult,
    toggleMuted,
    goHome,
    selectCharacter,
    buyCharacter,
    buyUpgrade,
    markTutorialDone,
  }
}
