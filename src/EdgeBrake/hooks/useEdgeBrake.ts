import { useCallback, useEffect, useRef, useState } from 'react'
import { CHARACTERS, CHARACTER_BY_ID, CHARACTER_IDS, DEFAULT_CHARACTER_ID, nextRosterCharacter } from '../characters'
import { evaluateStop } from '../rules'
import { CHARACTER_FRONT, FIELD_H, FIELD_W, type CharacterId, type RoundResult, type ViewState } from '../types'
import { playSound } from '../utils/sounds'

const START_X = 40
const READY_MS = 520
const STOP_HOLD_MS = 110
const FALL_MS = 1250
const SUCCESS_MS = 1550
const EARLY_FAIL_MS = 1450
const START_SPEED = 160
const BRAKE_FORCE = 225

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
  return ({
  phase: 'cover',
  x: START_X,
  velocity: 0,
  cliffX: 1880,
  isBraking: false,
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
  })
}

export function useEdgeBrake() {
  const [view, setView] = useState<ViewState>(initialState)
  const stateRef = useRef(view)
  const rafRef = useRef(0)
  const loopGenerationRef = useRef(0)
  const lastTsRef = useRef(0)
  const readyAtRef = useRef(0)
  const stopSinceRef = useRef<number | null>(null)
  const fallTimerRef = useRef<number | null>(null)
  const successTimerRef = useRef<number | null>(null)
  const earlyFailTimerRef = useRef<number | null>(null)
  const unlockTimerRef = useRef<number | null>(null)
  const retryUnlockAtRef = useRef(0)

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
    readyAtRef.current = performance.now()
    const current = stateRef.current
    const unlocked = unlockedOverride ?? [...current.unlockedCharacters]
    const nextCharacterId = characterId && unlocked.includes(characterId) ? characterId : current.characterId
    const maxLevel = Math.max(current.maxLevel, level)
    saveCollection(current.coins, unlocked, nextCharacterId, maxLevel)
    commit({
      ...current,
      phase: 'ready',
      x: START_X,
      velocity: START_SPEED,
      cliffX: randomCliff(),
      level,
      maxLevel,
      characterId: nextCharacterId,
      unlockedCharacters: unlocked,
      newUnlock,
      isBraking: false,
      result: null,
      eventKey: current.eventKey + 1,
    })
    if (newUnlock) {
      playSound('unlock', current.muted)
      unlockTimerRef.current = window.setTimeout(() => commit(now => ({ ...now, newUnlock: null })), 1700)
    }
  }, [commit])

  const start = useCallback(() => {
    clearTimers()
    const current = stateRef.current
    playSound('start', current.muted)
    commit({
      ...initialState(),
      phase: 'ready',
      velocity: START_SPEED,
      cliffX: randomCliff(),
      muted: current.muted,
      eventKey: current.eventKey + 1,
    })
    readyAtRef.current = performance.now()
    stopSinceRef.current = null
    lastTsRef.current = performance.now()
  }, [clearTimers, commit])

  const prepareRetry = useCallback(() => {
    clearTimers()
    const current = stateRef.current
    const reset = initialState()
    stopSinceRef.current = null
    retryUnlockAtRef.current = performance.now() + 500
    commit({
      ...reset,
      phase: 'awaiting',
      cliffX: randomCliff(),
      muted: current.muted,
      eventKey: current.eventKey + 1,
    })
    playSound('button', current.muted)
  }, [clearTimers, commit])

  const launchPrepared = useCallback(() => {
    const current = stateRef.current
    if (current.phase !== 'awaiting' || performance.now() < retryUnlockAtRef.current) return
    readyAtRef.current = performance.now()
    stopSinceRef.current = null
    lastTsRef.current = performance.now()
    commit({
      ...current,
      phase: 'ready',
      velocity: START_SPEED,
      isBraking: false,
      eventKey: current.eventKey + 1,
    })
  }, [commit])

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
      isBraking: true,
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
        commit(now => now.phase === 'success' ? { ...now, phase: 'result', isBraking: false } : now)
        successTimerRef.current = null
      }, SUCCESS_MS)
    } else {
      earlyFailTimerRef.current = window.setTimeout(() => {
        commit(now => now.phase === 'earlyFail' ? { ...now, phase: 'result', isBraking: false } : now)
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
      stopSinceRef.current = null
      retryUnlockAtRef.current = performance.now() + 500
      commit({
        ...current,
        phase: 'awaiting',
        x: START_X,
        velocity: 0,
        cliffX: randomCliff(),
        isBraking: false,
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
    commit({ ...current, phase: 'falling', isBraking: false, eventKey: current.eventKey + 1 })
    fallTimerRef.current = window.setTimeout(() => {
      commit(now => ({ ...now, phase: 'gameover', velocity: 0, isBraking: false }))
    }, FALL_MS)
  }, [commit])

  const tick = useCallback((ts: number) => {
    const current = stateRef.current
    const dt = Math.min((ts - lastTsRef.current) / 1000, 0.032)
    lastTsRef.current = ts

    if (current.phase === 'ready' && ts - readyAtRef.current >= READY_MS) {
      playSound('start', current.muted)
      commit({ ...current, phase: 'playing' })
    } else if (current.phase === 'playing') {
      const maxSpeed = Math.min(390 + (current.level - 1) * 12, 480)
      const runProgress = Math.min(1, Math.max(0, (current.x - START_X) / Math.max(1, current.cliffX - START_X)))
      const acceleration = runProgress < 0.3 ? 65 : runProgress < 0.68 ? 160 : 95
      let velocity = current.velocity
      if (current.isBraking) velocity = Math.max(0, velocity - BRAKE_FORCE * CHARACTER_BY_ID[current.characterId].friction * dt)
      else velocity = Math.min(maxSpeed, velocity + acceleration * dt)
      const x = current.x + velocity * dt
      const front = x + CHARACTER_FRONT

      if (front > current.cliffX + 12) {
        commit({ ...current, x, velocity })
        fall()
      } else if (current.isBraking && velocity < 3) {
        if (stopSinceRef.current === null) stopSinceRef.current = ts
        commit({ ...current, x, velocity })
        if (ts - stopSinceRef.current >= STOP_HOLD_MS) {
          finishRound(Math.max(0, Math.round(current.cliffX - front)))
          stopSinceRef.current = null
        }
      } else {
        stopSinceRef.current = null
        commit({ ...current, x, velocity })
      }
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

  const triggerBrake = useCallback(() => {
    const current = stateRef.current
    if (current.phase !== 'playing') return
    if (current.isBraking) return
    playSound('brake', current.muted)
    commit({ ...current, isBraking: true })
  }, [commit])

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
      if ((event.code === 'Space' || event.code === 'Enter') && !event.repeat) {
        event.preventDefault()
        if (stateRef.current.phase === 'cover') start()
        else if (stateRef.current.phase === 'awaiting') launchPrepared()
        else if (stateRef.current.phase === 'result') advanceResult()
        else triggerBrake()
      }
    }
    window.addEventListener('keydown', keyDown)
    return () => {
      window.removeEventListener('keydown', keyDown)
    }
  }, [advanceResult, launchPrepared, start, triggerBrake])

  useEffect(() => () => clearTimers(), [clearTimers])

  const [scale, setScale] = useState(1)
  useEffect(() => {
    const compute = () => setScale(Math.min(window.innerWidth / FIELD_W, window.innerHeight / FIELD_H))
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [])

  return { view, scale, start, prepareRetry, launchPrepared, advanceResult, triggerBrake, toggleMuted, goHome, selectCharacter, buyCharacter }
}
