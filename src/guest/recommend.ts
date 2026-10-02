import type { CharacterSpec } from '../EdgeBrake/characters'
import { launchVelocityFor, slideDecelerationFor, speedFactor } from '../EdgeBrake/physics'
import { CHARACTER_FRONT } from '../EdgeBrake/types'
import type { WeatherKind } from '../EdgeBrake/types'
import { springMultiplier, studMultiplier } from './meta'

const START_X = 40
const AIM_GAP = 8

export interface HoldHint {
  power: number
  text: string
}

export function suggestHold(
  character: CharacterSpec,
  weather: WeatherKind,
  cliffX: number,
  springs: number,
  studs: number,
  sense: number,
): HoldHint | null {
  if (sense <= 0) return null
  const deceleration = slideDecelerationFor(character, weather) * studMultiplier(studs)
  const travel = Math.max(80, cliffX - START_X - CHARACTER_FRONT - AIM_GAP)
  const neededSpeed = Math.sqrt(2 * deceleration * travel)
  const launchScale = speedFactor(character.speed) * springMultiplier(springs)
  const raw = (neededSpeed / launchScale - 335) / 365
  if (!Number.isFinite(raw)) return null
  if (raw >= 1) return { power: 1, text: sense >= 2 ? 'FULL HOLD' : 'HOLD LONG' }
  if (raw <= 0.12) return { power: 0.12, text: sense >= 2 ? 'LIGHT TAP' : 'HOLD SHORT' }
  if (sense <= 1) {
    if (raw < 0.4) return { power: 0.28, text: 'HOLD SHORT' }
    if (raw < 0.72) return { power: 0.55, text: 'HOLD MEDIUM' }
    return { power: 0.86, text: 'HOLD LONG' }
  }
  if (sense === 2) {
    const power = Math.min(1, Math.max(0.12, Math.round(raw * 10) / 10))
    return { power, text: `TARGET ${Math.round(power * 100)}%` }
  }
  const power = Math.min(1, Math.max(0.12, Math.round(raw * 100) / 100))
  return { power, text: `TARGET ${Math.round(power * 100)}%` }
}

export function hintedLaunchSpeed(character: CharacterSpec, power: number, springs: number) {
  return launchVelocityFor(character, power) * springMultiplier(springs)
}
