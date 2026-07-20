export const FIELD_W = 390
export const FIELD_H = 700
export const PENGUIN_W = 58
export const CHARACTER_FRONT = 49

export type GamePhase = 'cover' | 'awaiting' | 'ready' | 'playing' | 'result' | 'falling' | 'gameover'
export type Rating = 'edge' | 'great' | 'safe' | 'early'
export type CharacterId = string
export type WeatherKind = 'clear' | 'snow' | 'fog' | 'blizzard'

export interface RoundResult {
  distance: number
  rating: Rating
  points: number
  coins: number
  passed: boolean
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
  coins: number
  runCoins: number
  maxLevel: number
  characterId: CharacterId
  unlockedCharacters: CharacterId[]
  newUnlock: CharacterId | null
  result: RoundResult | null
  eventKey: number
  muted: boolean
}
