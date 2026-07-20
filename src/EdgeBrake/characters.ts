import assetCatalog from './assets/characters/ASSETS.json'
import type { CharacterId, WeatherKind } from './types'

const CHARACTER_CATEGORIES = ['people', 'archetypes', 'monsters', 'office', 'villains', 'mechs', 'mythic', 'animals'] as const
export type CharacterCategory = typeof CHARACTER_CATEGORIES[number]
export type CharacterMotion = 'human' | 'hover' | 'mech' | 'quadruped' | 'bird' | 'frog'

interface CatalogCharacter {
  category: CharacterCategory
  id: string
  name_zh: string
  name_en: string
  footprint: [number, number, number]
}

export interface CharacterSpec {
  id: CharacterId
  nameZh: string
  nameEn: string
  category: CharacterCategory
  motion: CharacterMotion
  friction: number
  cost: number
  scale: number
  headingYaw: number
  modelUrl: string
  spriteUrl: string
  rosterIndex: number
}

const modelUrls = import.meta.glob('./assets/characters/*.glb', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const spriteUrls = import.meta.glob('./assets/characters/*.png', { eager: true, import: 'default' }) as Record<string, string>
const isCharacterCategory = (category: string): category is CharacterCategory => CHARACTER_CATEGORIES.includes(category as CharacterCategory)
const catalogCharacters = assetCatalog.assets.filter(asset => isCharacterCategory(asset.category)) as unknown as CatalogCharacter[]

const ANIMAL_GRIP: Record<string, number> = {
  pig: 1.14, cow: 1.1, cat: 1.08, fox: 1.05, chicken: 1.15, frog: 1.24,
  dog: 1.08, sheep: 1.13, rabbit: 1.18, bear: 1.18, duck: 1.16,
}

const SPECIAL_GRIP: Record<string, number> = {
  punk: 0.84, ghost: 0.82, skeleton: 0.78, combatMech: 1.16, minotaur: 1.14,
  swat: 1.08, viking: 1.12, bigGuy: 1.14, werewolf: 1.12,
}

function motionFor(category: CharacterCategory, id: string): CharacterMotion {
  if (id === 'ghost') return 'hover'
  if (category === 'mechs') return 'mech'
  if (id === 'frog') return 'frog'
  if (id === 'chicken' || id === 'duck') return 'bird'
  if (category === 'animals') return 'quadruped'
  return 'human'
}

function frictionFor(asset: CatalogCharacter) {
  if (SPECIAL_GRIP[asset.id]) return SPECIAL_GRIP[asset.id]
  if (asset.category === 'animals') return ANIMAL_GRIP[asset.id] ?? 1.08
  const [width, height] = asset.footprint
  return Number(Math.min(1.16, Math.max(0.86, 0.79 + (width / height) * 0.62)).toFixed(2))
}

function scaleFor(asset: CatalogCharacter, motion: CharacterMotion) {
  const height = asset.footprint[1]
  if (motion === 'hover') return 1.02
  if (motion === 'frog') return 1.08
  if (motion === 'bird') return 1
  if (motion === 'quadruped') return asset.id === 'bear' || asset.id === 'cow' ? 0.9 : 0.96
  return Number(Math.min(0.94, Math.max(0.62, 2.12 / height)).toFixed(3))
}

function assetUrl(category: string, id: string, extension: 'glb' | 'png') {
  const key = `./assets/characters/${category}__${id}.${extension}`
  const url = extension === 'glb' ? modelUrls[key] : spriteUrls[key]
  if (!url) throw new Error(`Missing character asset: ${key}`)
  return url
}

export const CHARACTERS: CharacterSpec[] = catalogCharacters.map((asset, rosterIndex) => {
  const motion = motionFor(asset.category, asset.id)
  return {
    id: asset.id,
    nameZh: asset.name_zh,
    nameEn: asset.name_en,
    category: asset.category,
    motion,
    friction: frictionFor(asset),
    cost: Math.min(260, 12 + rosterIndex * 5),
    scale: scaleFor(asset, motion),
    headingYaw: asset.category === 'animals' ? 0 : Math.PI / 2,
    modelUrl: assetUrl(asset.category, asset.id, 'glb'),
    spriteUrl: assetUrl(asset.category, asset.id, 'png'),
    rosterIndex,
  }
})

if (CHARACTERS.length !== 52) throw new Error(`Expected 52 playable characters, found ${CHARACTERS.length}`)

export const DEFAULT_CHARACTER_ID = CHARACTERS[0].id
export const CHARACTER_IDS = CHARACTERS.map(character => character.id)
export const CHARACTER_BY_ID = Object.fromEntries(CHARACTERS.map(character => [character.id, character])) as Record<CharacterId, CharacterSpec>

export function characterName(characterId: CharacterId, locale: 'zh' | 'en') {
  const character = CHARACTER_BY_ID[characterId] ?? CHARACTERS[0]
  return locale === 'zh' ? character.nameZh : character.nameEn.toUpperCase()
}

export function nextRosterCharacter(characterId: CharacterId) {
  const currentIndex = CHARACTER_BY_ID[characterId]?.rosterIndex ?? -1
  return CHARACTERS[(currentIndex + 1) % CHARACTERS.length]
}

export function weatherForLevel(level: number): WeatherKind {
  const cycle: WeatherKind[] = ['clear', 'snow', 'clear', 'fog', 'snow', 'blizzard']
  return cycle[(Math.max(1, level) - 1) % cycle.length]
}
