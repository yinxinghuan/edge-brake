import kidModel from './assets/characters/people__kid.glb?url'
import kidSprite from './assets/characters/people__kid.png'
import grannyModel from './assets/characters/people__granny.glb?url'
import grannySprite from './assets/characters/people__granny.png'
import businessmanModel from './assets/characters/people__businessman.glb?url'
import businessmanSprite from './assets/characters/people__businessman.png'
import foxModel from './assets/characters/animals__fox.glb?url'
import foxSprite from './assets/characters/animals__fox.png'
import frogModel from './assets/characters/animals__frog.glb?url'
import frogSprite from './assets/characters/animals__frog.png'
import bearModel from './assets/characters/animals__bear.glb?url'
import bearSprite from './assets/characters/animals__bear.png'
import type { CharacterId, WeatherKind } from './types'

export interface CharacterSpec {
  id: CharacterId
  friction: number
  cost: number
  unlockLevel?: number
  scale: number
  kind: 'penguin' | 'person' | 'animal'
  modelUrl?: string
  spriteUrl?: string
}

export const CHARACTERS: CharacterSpec[] = [
  { id: 'penguin', friction: 1, cost: 0, scale: 1, kind: 'penguin' },
  { id: 'kid', friction: 1.12, cost: 12, unlockLevel: 3, scale: 0.85, kind: 'person', modelUrl: kidModel, spriteUrl: kidSprite },
  { id: 'granny', friction: 0.92, cost: 24, scale: 0.74, kind: 'person', modelUrl: grannyModel, spriteUrl: grannySprite },
  { id: 'businessman', friction: 0.84, cost: 40, scale: 0.74, kind: 'person', modelUrl: businessmanModel, spriteUrl: businessmanSprite },
  { id: 'fox', friction: 1.05, cost: 60, unlockLevel: 5, scale: 0.98, kind: 'animal', modelUrl: foxModel, spriteUrl: foxSprite },
  { id: 'frog', friction: 1.22, cost: 85, scale: 1.08, kind: 'animal', modelUrl: frogModel, spriteUrl: frogSprite },
  { id: 'bear', friction: 0.76, cost: 120, scale: 0.92, kind: 'animal', modelUrl: bearModel, spriteUrl: bearSprite },
]

export const CHARACTER_BY_ID = Object.fromEntries(CHARACTERS.map(character => [character.id, character])) as Record<CharacterId, CharacterSpec>

export function weatherForLevel(level: number): WeatherKind {
  const cycle: WeatherKind[] = ['clear', 'snow', 'clear', 'fog', 'snow', 'blizzard']
  return cycle[(Math.max(1, level) - 1) % cycle.length]
}
