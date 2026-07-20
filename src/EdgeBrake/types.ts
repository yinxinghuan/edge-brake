export const FIELD_W = 390
export const FIELD_H = 700
export const PENGUIN_W = 58
export const PENGUIN_FRONT = 49

export type GamePhase = 'cover' | 'ready' | 'playing' | 'result' | 'falling' | 'gameover'
export type Rating = 'edge' | 'great' | 'safe' | 'early'

export interface RoundResult {
  distance: number
  rating: Rating
  points: number
}

export interface ViewState {
  phase: GamePhase
  x: number
  velocity: number
  cliffX: number
  isBraking: boolean
  score: number
  level: number
  combo: number
  bestCombo: number
  bestDistance: number | null
  bestScore: number
  result: RoundResult | null
  eventKey: number
  muted: boolean
}
