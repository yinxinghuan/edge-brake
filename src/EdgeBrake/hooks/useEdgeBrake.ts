import { useCallback, useEffect, useRef, useState } from 'react'
import { FIELD_H, FIELD_W, PENGUIN_FRONT, type Rating, type RoundResult, type ViewState } from '../types'
import { playSound } from '../utils/sounds'

const START_X = 64
const READY_MS = 500
const STOP_HOLD_MS = 110
const RESULT_MS = 850
const FALL_MS = 650
const START_SPEED = 96
const ACCELERATION = 70
const BRAKE_FORCE = 260

function randomCliff() {
  return 330 + Math.round(Math.random() * 20)
}

function readNumber(key: string, fallback: number) {
  const value = Number(localStorage.getItem(key))
  return Number.isFinite(value) ? value : fallback
}

const initialState = (): ViewState => ({
  phase: 'cover',
  x: START_X,
  velocity: 0,
  cliffX: 340,
  isBraking: false,
  score: 0,
  level: 1,
  combo: 0,
  bestCombo: readNumber('edge_brake_best_combo', 0),
  bestDistance: localStorage.getItem('edge_brake_best_distance') === null
    ? null
    : readNumber('edge_brake_best_distance', 0),
  bestScore: readNumber('edge_brake_best_score', 0),
  result: null,
  eventKey: 0,
  muted: localStorage.getItem('edge_brake_muted') === '1',
})

export function useEdgeBrake() {
  const [view, setView] = useState<ViewState>(initialState)
  const stateRef = useRef(view)
  const rafRef = useRef(0)
  const loopGenerationRef = useRef(0)
  const lastTsRef = useRef(0)
  const readyAtRef = useRef(0)
  const stopSinceRef = useRef<number | null>(null)
  const resultTimerRef = useRef<number | null>(null)
  const fallTimerRef = useRef<number | null>(null)

  const commit = useCallback((next: ViewState | ((current: ViewState) => ViewState)) => {
    const value = typeof next === 'function' ? next(stateRef.current) : next
    stateRef.current = value
    setView(value)
  }, [])

  const clearTimers = useCallback(() => {
    if (resultTimerRef.current !== null) window.clearTimeout(resultTimerRef.current)
    if (fallTimerRef.current !== null) window.clearTimeout(fallTimerRef.current)
    resultTimerRef.current = null
    fallTimerRef.current = null
  }, [])

  const beginRound = useCallback((level: number) => {
    stopSinceRef.current = null
    readyAtRef.current = performance.now()
    commit(current => ({
      ...current,
      phase: 'ready',
      x: START_X,
      velocity: START_SPEED,
      cliffX: randomCliff(),
      level,
      isBraking: false,
      result: null,
      eventKey: current.eventKey + 1,
    }))
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

  const finishRound = useCallback((distance: number) => {
    const current = stateRef.current
    let rating: Rating = 'early'
    let basePoints = 0
    if (distance <= 8) {
      rating = 'edge'
      basePoints = 5
    } else if (distance <= 22) {
      rating = 'great'
      basePoints = 3
    } else if (distance <= 52) {
      rating = 'safe'
      basePoints = 1
    }

    const nextCombo = rating === 'edge' ? current.combo + 1 : 0
    const bonus = rating === 'edge' ? Math.min(Math.max(nextCombo - 1, 0), 5) : 0
    const points = basePoints + bonus
    const nextScore = current.score + points
    const nextBestScore = Math.max(current.bestScore, nextScore)
    const nextBestCombo = Math.max(current.bestCombo, nextCombo)
    const nextBestDistance = current.bestDistance === null ? distance : Math.min(current.bestDistance, distance)
    const result: RoundResult = { distance, rating, points }

    localStorage.setItem('edge_brake_best_score', String(nextBestScore))
    localStorage.setItem('edge_brake_best_combo', String(nextBestCombo))
    localStorage.setItem('edge_brake_best_distance', String(nextBestDistance))
    playSound(rating === 'edge' ? 'edge' : rating === 'great' ? 'great' : 'safe', current.muted)

    commit({
      ...current,
      phase: 'result',
      velocity: 0,
      isBraking: true,
      score: nextScore,
      combo: nextCombo,
      bestScore: nextBestScore,
      bestCombo: nextBestCombo,
      bestDistance: nextBestDistance,
      result,
      eventKey: current.eventKey + 1,
    })

    resultTimerRef.current = window.setTimeout(() => beginRound(current.level + 1), RESULT_MS)
  }, [beginRound, commit])

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
      const maxSpeed = Math.min(238 + (current.level - 1) * 10, 330)
      let velocity = current.velocity
      if (current.isBraking) velocity = Math.max(0, velocity - BRAKE_FORCE * dt)
      else velocity = Math.min(maxSpeed, velocity + ACCELERATION * dt)
      const x = current.x + velocity * dt
      const front = x + PENGUIN_FRONT

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
    if (current.phase !== 'ready' && current.phase !== 'playing') return
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

  const goHome = useCallback(() => {
    clearTimers()
    commit(current => ({ ...initialState(), muted: current.muted, eventKey: current.eventKey + 1 }))
  }, [clearTimers, commit])

  useEffect(() => {
    const keyDown = (event: KeyboardEvent) => {
      if ((event.code === 'Space' || event.code === 'Enter') && !event.repeat) {
        event.preventDefault()
        triggerBrake()
      }
    }
    window.addEventListener('keydown', keyDown)
    return () => {
      window.removeEventListener('keydown', keyDown)
    }
  }, [triggerBrake])

  useEffect(() => () => clearTimers(), [clearTimers])

  const [scale, setScale] = useState(1)
  useEffect(() => {
    const compute = () => setScale(Math.min(window.innerWidth / FIELD_W, window.innerHeight / FIELD_H))
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [])

  return { view, scale, start, triggerBrake, toggleMuted, goHome }
}
