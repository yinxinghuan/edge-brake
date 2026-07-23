import type { CharacterSpec } from './characters'
import type { WeatherKind } from './types'

export const FULL_CHARGE_MS = 1600
export const MIN_CHARGE_MS = 80

export const SURFACE_FACTOR: Record<WeatherKind, number> = {
  clear: 1,
  snow: 1.05,
  fog: 0.94,
  blizzard: 1.03,
}

export function chargePowerForMs(holdMs: number) {
  const normalized = Math.min(1, Math.max(MIN_CHARGE_MS, holdMs) / FULL_CHARGE_MS)
  return 0.12 + 0.88 * Math.pow(normalized, 1.35)
}

export function speedFactor(speed: number) {
  const normalized = Math.min(1, Math.max(0, (speed - 2.6) / 2.4))
  return 0.86 + normalized * 0.28
}

export function launchVelocityFor(character: CharacterSpec, power: number) {
  return (335 + 365 * Math.min(1, Math.max(0.12, power))) * speedFactor(character.speed)
}

export function slideDecelerationFor(character: CharacterSpec, weather: WeatherKind) {
  const inertia = Math.pow(75 / character.weight, 0.22)
  return Math.min(166, Math.max(92, 126 * SURFACE_FACTOR[weather] * inertia))
}
