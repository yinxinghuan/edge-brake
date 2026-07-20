import type { Rating } from './types'

export interface StopEvaluation {
  rating: Rating
  points: number
  passed: boolean
  nextCombo: number
  coins: number
}

export function evaluateStop(distance: number, combo: number): StopEvaluation {
  let rating: Rating = 'early'
  let points = 20
  if (distance <= 10) {
    rating = 'edge'
    points = 100
  } else if (distance <= 35) {
    rating = 'great'
    points = 90
  } else if (distance <= 80) {
    rating = 'safe'
    points = 75
  } else if (distance <= 140) {
    rating = 'safe'
    points = 60
  } else if (distance <= 220) {
    rating = 'safe'
    points = 45
  }

  const passed = distance <= 220
  const nextCombo = rating === 'edge' ? combo + 1 : 0
  const coins = (points === 100 ? 10 : points === 90 ? 8 : points === 75 ? 6 : points === 60 ? 5 : points === 45 ? 4 : 2) + Math.min(nextCombo, 3)
  return { rating, points, passed, nextCombo, coins }
}
