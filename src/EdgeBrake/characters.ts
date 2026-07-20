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
  weight: number
  speed: number
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

const ANIMAL_WEIGHT: Record<string, number> = {
  pig: 92, cow: 180, cat: 28, fox: 34, chicken: 18, frog: 22,
  dog: 38, sheep: 75, rabbit: 26, bear: 210, duck: 20,
}

const SPECIAL_WEIGHT: Record<string, number> = {
  kid: 32, teen: 48, bigGuy: 125, ghost: 24, skeleton: 32, zombie: 78,
  werewolf: 105, swat: 95, viking: 112, combatMech: 240, minotaur: 190,
}

const ANIMAL_SPEED: Record<string, number> = {
  pig: 3.0, cow: 2.7, cat: 4.6, fox: 4.8, chicken: 3.8, frog: 4.1,
  dog: 4.5, sheep: 3.2, rabbit: 5.0, bear: 2.8, duck: 3.7,
}

const SPECIAL_SPEED: Record<string, number> = {
  kid: 4.5, teen: 4.3, bigGuy: 3.0, ghost: 4.8, skeleton: 4.4, zombie: 2.6,
  werewolf: 4.2, swat: 3.7, viking: 3.2, combatMech: 2.8, minotaur: 3.3,
}

function motionFor(category: CharacterCategory, id: string): CharacterMotion {
  if (id === 'ghost') return 'hover'
  if (category === 'mechs') return 'mech'
  if (id === 'frog') return 'frog'
  if (id === 'chicken' || id === 'duck') return 'bird'
  if (category === 'animals') return 'quadruped'
  return 'human'
}

function weightFor(asset: CatalogCharacter) {
  if (SPECIAL_WEIGHT[asset.id]) return SPECIAL_WEIGHT[asset.id]
  if (asset.category === 'animals') return ANIMAL_WEIGHT[asset.id] ?? 45
  const [width, height, depth] = asset.footprint
  const categoryMass = asset.category === 'monsters' ? 20 : asset.category === 'office' ? 7 : asset.category === 'archetypes' ? 10 : 0
  return Math.round(Math.min(165, Math.max(42, 34 + width * height * depth * 10 + categoryMass)))
}

function speedFor(asset: CatalogCharacter, motion: CharacterMotion) {
  if (SPECIAL_SPEED[asset.id]) return SPECIAL_SPEED[asset.id]
  if (asset.category === 'animals') return ANIMAL_SPEED[asset.id] ?? 3.8
  const [, height] = asset.footprint
  const motionBias = motion === 'mech' ? -0.65 : motion === 'hover' ? 0.65 : 0
  return Number(Math.min(4.7, Math.max(2.6, 3.75 + (height - 2.7) * 0.32 + motionBias)).toFixed(1))
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
    weight: weightFor(asset),
    speed: speedFor(asset, motion),
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
