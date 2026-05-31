import type { RankingItem } from './ranking'

// New / unranked players are treated as 1500 ELO until they accumulate
// enough games to land in the rankings table.
const DEFAULT_PLAYER_RATING = 1500

// Total points the K factor distributes between the two sides per match.
const K = 50

export const playerPoints = (
  rankings: RankingItem[] | undefined,
  name: string | null,
): number => {
  if (!name) return 0
  return rankings?.find((r) => r.name === name)?.points ?? DEFAULT_PLAYER_RATING
}

export const teamTotal = (
  rankings: RankingItem[] | undefined,
  p1: string | null,
  p2: string | null,
): number => playerPoints(rankings, p1) + playerPoints(rankings, p2)

// ELO-style stakes. Each side has a *different* potential reward: a
// low-rated team beating a high-rated team gets a bigger share of the K
// factor, and the inverse for the favored team. A tie awards 0 (handled
// by `stakeFor` below).
export const calculateStakes = (
  redTotal: number,
  blueTotal: number,
): { redWin: number; blueWin: number } => {
  const redDiff = blueTotal - redTotal
  const redWe = 1 / (Math.pow(10, redDiff / 1000) + 1)
  const blueWe = 1 - redWe
  let redWin = Math.floor(K * (1 - redWe))
  let blueWin = Math.floor(K * (1 - blueWe))
  // The two Math.floor truncations can shave 1-2 points off the K total.
  // Bump the smaller-but-not-tiny side back up so the pair still sums to K.
  if (redWin + blueWin < K) {
    if (blueWin < redWin) blueWin = K - redWin
    else redWin = K - blueWin
  }
  return { redWin, blueWin }
}

export const stakeFor = (
  winner: 'red' | 'blue' | 'draw',
  redTotal: number,
  blueTotal: number,
): number => {
  if (winner === 'draw') return 0
  const { redWin, blueWin } = calculateStakes(redTotal, blueTotal)
  return winner === 'red' ? redWin : blueWin
}
