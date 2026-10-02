import type { CharacterSpec } from '../EdgeBrake/characters'
import { launchVelocityFor, slideDecelerationFor, speedFactor } from '../EdgeBrake/physics'
import { CHARACTER_FRONT } from '../EdgeBrake/types'
import type { WeatherKind } from '../EdgeBrake/types'
import { springMultiplier, studMultiplier } from './meta'

const START_X = 40
const AIM_GAP = 8

export interface HoldHint {
  power: number
  spread: number
  text: string
  precise: boolean
}

export function suggestHold(
  character: CharacterSpec,
  weather: WeatherKind,
  cliffX: number,
  springs: number,
  studs: number,
  sense: number,
): HoldHint | null {
  const deceleration = slideDecelerationFor(character, weather) * studMultiplier(studs)
  const travel = Math.max(80, cliffX - START_X - CHARACTER_FRONT - AIM_GAP)
  const neededSpeed = Math.sqrt(2 * deceleration * travel)
  const launchScale = speedFactor(character.speed) * springMultiplier(springs)
  const raw = (neededSpeed / launchScale - 335) / 365
  if (!Number.isFinite(raw)) return null
  const power = Math.min(1, Math.max(0.12, raw))
  if (sense <= 0) {
    const bucket = power < 0.4 ? 0.3 : power < 0.72 ? 0.55 : 0.82
    const text = power < 0.4 ? 'HOLD SHORT' : power < 0.72 ? 'HOLD MEDIUM' : 'HOLD LONG'
    return { power: bucket, spread: 0.16, text, precise: false }
  }
  if (power >= 0.98) return { power: 1, spread: sense >= 2 ? 0.04 : 0.1, text: sense >= 2 ? 'FULL HOLD' : 'HOLD LONG', precise: sense >= 2 }
  if (power <= 0.14) return { power: 0.12, spread: sense >= 2 ? 0.04 : 0.1, text: sense >= 2 ? 'LIGHT TAP' : 'HOLD SHORT', precise: sense >= 2 }
  if (sense === 1) {
    if (power < 0.4) return { power: 0.3, spread: 0.1, text: 'HOLD SHORT', precise: false }
    if (power < 0.72) return { power: 0.55, spread: 0.1, text: 'HOLD MEDIUM', precise: false }
    return { power: 0.82, spread: 0.1, text: 'HOLD LONG', precise: false }
  }
  if (sense === 2) {
    const snapped = Math.min(1, Math.max(0.12, Math.round(power * 10) / 10))
    return { power: snapped, spread: 0.045, text: `TARGET ${Math.round(snapped * 100)}%`, precise: true }
  }
  const exact = Math.min(1, Math.max(0.12, Math.round(power * 100) / 100))
  return { power: exact, spread: 0.02, text: `TARGET ${Math.round(exact * 100)}%`, precise: true }
}

export function hintedLaunchSpeed(character: CharacterSpec, power: number, springs: number) {
  return launchVelocityFor(character, power) * springMultiplier(springs)
}
