import { useCallback, useEffect, useRef, useState } from 'react'
import { CHARACTERS, CHARACTER_BY_ID, CHARACTER_IDS, DEFAULT_CHARACTER_ID, nextRosterCharacter, weatherForLevel } from '../characters'
import { chargePowerForMs, launchVelocityFor, slideDecelerationFor } from '../physics'
import { evaluateStop } from '../rules'
import { CHARACTER_FRONT, FIELD_H, FIELD_W, type CharacterId, type RoundResult, type ViewState } from '../types'
import { playSound } from '../utils/sounds'

const START_X = 40
const STOP_HOLD_MS = 140
const FALL_MS = 1250
const SUCCESS_MS = 1550
const EARLY_FAIL_MS = 1450

function randomCliff() {
  return 1820 + Math.round(Math.random() * 120)
}

function readNumber(key: string, fallback: number) {
  const value = Number(localStorage.getItem(key))
  return Number.isFinite(value) ? value : fallback
}

function readUnlocked(): CharacterId[] {
  try {
    const parsed = JSON.parse(localStorage.getItem('edge_brake_unlocked') || '[]')
    const valid = Array.isArray(parsed) ? parsed.filter((id): id is CharacterId => CHARACTER_IDS.includes(id)) : []
    return Array.from(new Set<CharacterId>([DEFAULT_CHARACTER_ID, ...valid]))
  } catch {
    return [DEFAULT_CHARACTER_ID]
  }
}

function readCharacter(unlocked: CharacterId[]): CharacterId {
  const saved = localStorage.getItem('edge_brake_character') as CharacterId | null
  return saved && unlocked.includes(saved) ? saved : DEFAULT_CHARACTER_ID
}

function saveCollection(coins: number, unlocked: CharacterId[], characterId: CharacterId, maxLevel: number) {
  localStorage.setItem('edge_brake_coins', String(coins))
  localStorage.setItem('edge_brake_unlocked', JSON.stringify(unlocked))
  localStorage.setItem('edge_brake_character', characterId)
  localStorage.setItem('edge_brake_max_level', String(maxLevel))
}

const initialState = (): ViewState => {
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
    bestCombo: readNumber('edge_brake_best_combo', 0),
    bestDistance: localStorage.getItem('edge_brake_best_distance') === null
      ? null
      : readNumber('edge_brake_best_distance', 0),
    bestScore: readNumber('edge_brake_best_score', 0),
    coins: readNumber('edge_brake_coins', 0),
    runCoins: 0,
    maxLevel: readNumber('edge_brake_max_level', 1),
    characterId: readCharacter(unlockedCharacters),
    unlockedCharacters,
    newUnlock: null,
    result: null,
    eventKey: 0,
    muted: localStorage.getItem('edge_brake_muted') === '1',
  }
}

export function useEdgeBrake() {
  const [view, setView] = useState<ViewState>(initialState)
  const stateRef = useRef(view)
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
  const inputUnlockAtRef = useRef(0)

  const commit = useCallback((next: ViewState | ((current: ViewState) => ViewState)) => {
    const value = typeof next === 'function' ? next(stateRef.current) : next
    stateRef.current = value
    setView(value)
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

  const beginRound = useCallback((level: number, characterId?: CharacterId, unlockedOverride?: CharacterId[], newUnlock: CharacterId | null = null) => {
    stopSinceRef.current = null
    highChargeCueRef.current = false
    const current = stateRef.current
    const unlocked = unlockedOverride ?? [...current.unlockedCharacters]
    const nextCharacterId = characterId && unlocked.includes(characterId) ? characterId : current.characterId
    const maxLevel = Math.max(current.maxLevel, level)
    saveCollection(current.coins, unlocked, nextCharacterId, maxLevel)
    inputUnlockAtRef.current = performance.now() + 240
    commit({
      ...current,
      phase: 'awaiting',
      x: START_X,
      velocity: 0,
      cliffX: randomCliff(),
      level,
      maxLevel,
      characterId: nextCharacterId,
      unlockedCharacters: unlocked,
      newUnlock,
      isCharging: false,
      isAutoBraking: false,
      chargePower: 0,
      result: null,
      eventKey: current.eventKey + 1,
    })
    if (newUnlock) {
      playSound('unlock', current.muted)
      unlockTimerRef.current = window.setTimeout(() => commit(now => ({ ...now, newUnlock: null })), 1700)
    }
  }, [commit])

  const beginCharge = useCallback(() => {
    const current = stateRef.current
    if ((current.phase !== 'cover' && current.phase !== 'awaiting') || performance.now() < inputUnlockAtRef.current) return
    clearTimers()
    const base = current.phase === 'cover'
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
      isCharging: true,
      isAutoBraking: false,
      chargePower: chargePowerForMs(0),
      result: null,
      eventKey: base.eventKey + 1,
    })
  }, [clearTimers, commit])

  const releaseCharge = useCallback(() => {
    const current = stateRef.current
    if (current.phase !== 'charging') return
    const power = chargePowerForMs(performance.now() - chargeStartedAtRef.current)
    const velocity = launchVelocityFor(CHARACTER_BY_ID[current.characterId], power)
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
  }, [clearTimers, commit])

  const finishRound = useCallback((distance: number) => {
    const current = stateRef.current
    const { rating, points, passed, nextCombo, coins: earnedCoins } = evaluateStop(distance, current.combo)
    const nextScore = current.score + points
    const nextBestScore = Math.max(current.bestScore, nextScore)
    const nextBestCombo = Math.max(current.bestCombo, nextCombo)
    const nextBestDistance = current.bestDistance === null ? distance : Math.min(current.bestDistance, distance)
    const result: RoundResult = { distance, rating, points, coins: earnedCoins, passed }
    const nextCoins = current.coins + earnedCoins

    localStorage.setItem('edge_brake_best_score', String(nextBestScore))
    localStorage.setItem('edge_brake_best_combo', String(nextBestCombo))
    localStorage.setItem('edge_brake_best_distance', String(nextBestDistance))
    saveCollection(nextCoins, current.unlockedCharacters, current.characterId, current.maxLevel)
    playSound(rating === 'edge' ? 'edge' : rating === 'great' ? 'great' : rating === 'early' ? 'earlyFail' : 'safe', current.muted)
    window.setTimeout(() => playSound('coin', current.muted), 90)

    commit({
      ...current,
      phase: passed ? 'success' : 'earlyFail',
      velocity: 0,
      isCharging: false,
      score: nextScore,
      combo: nextCombo,
      bestScore: nextBestScore,
      bestCombo: nextBestCombo,
      bestDistance: nextBestDistance,
      coins: nextCoins,
      runCoins: current.runCoins + earnedCoins,
      result,
      eventKey: current.eventKey + 1,
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
  }, [commit])

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
    const deceleration = slideDecelerationFor(character, weatherForLevel(current.level))
    const velocity = Math.max(0, current.velocity - deceleration * dt)
    const remainingToCliff = Math.max(0, current.cliffX - (current.x + CHARACTER_FRONT))
    const timeToCliff = remainingToCliff / Math.max(1, velocity)
    const isAutoBraking = velocity > 3 && (velocity / deceleration <= 1.25 || timeToCliff <= 0.9)
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
    localStorage.setItem('edge_brake_muted', next ? '1' : '0')
    commit({ ...stateRef.current, muted: next })
    if (!next) playSound('button', false)
  }, [commit])

  const selectCharacter = useCallback((characterId: CharacterId) => {
    const current = stateRef.current
    if (!current.unlockedCharacters.includes(characterId)) return false
    saveCollection(current.coins, current.unlockedCharacters, characterId, current.maxLevel)
    playSound('button', current.muted)
    commit({ ...current, characterId, eventKey: current.eventKey + 1 })
    return true
  }, [commit])

  const buyCharacter = useCallback((characterId: CharacterId) => {
    const current = stateRef.current
    const spec = CHARACTER_BY_ID[characterId]
    if (current.unlockedCharacters.includes(characterId)) return selectCharacter(characterId)
    if (current.coins < spec.cost) {
      playSound('deny', current.muted)
      return false
    }
    const unlockedCharacters = [...current.unlockedCharacters, characterId]
    const coins = current.coins - spec.cost
    saveCollection(coins, unlockedCharacters, characterId, current.maxLevel)
    playSound('unlock', current.muted)
    commit({ ...current, coins, unlockedCharacters, characterId, eventKey: current.eventKey + 1 })
    return true
  }, [commit, selectCharacter])

  const goHome = useCallback(() => {
    clearTimers()
    commit(current => ({ ...initialState(), muted: current.muted, eventKey: current.eventKey + 1 }))
  }, [clearTimers, commit])

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if ((event.code !== 'Space' && event.code !== 'Enter') || event.repeat) return
      event.preventDefault()
      if (stateRef.current.phase === 'result') advanceResult()
      else beginCharge()
    }
    const keyUp = (event: KeyboardEvent) => {
      if (event.code !== 'Space' && event.code !== 'Enter') return
      event.preventDefault()
      releaseCharge()
    }
    window.addEventListener('keydown', keyDown)
    window.addEventListener('keyup', keyUp)
    return () => {
      window.removeEventListener('keydown', keyDown)
      window.removeEventListener('keyup', keyUp)
    }
  }, [advanceResult, beginCharge, releaseCharge])

  useEffect(() => () => clearTimers(), [clearTimers])

  const [scale, setScale] = useState(1)
  useEffect(() => {
    const compute = () => setScale(Math.min(window.innerWidth / FIELD_W, window.innerHeight / FIELD_H))
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [])

  return { view, scale, beginCharge, releaseCharge, prepareRetry, advanceResult, toggleMuted, goHome, selectCharacter, buyCharacter }
}
