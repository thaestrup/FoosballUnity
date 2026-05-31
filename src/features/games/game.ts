import { z } from 'zod'

// The backend stores missing player slots as the literal string "null"
// (Groovy concat in `Games.groovy:insertGame`), not SQL NULL. Normalize at
// parse time so consumers see an actual JS null. See FINDINGS.md.
const playerName = z
  .union([z.string(), z.null()])
  .transform((s) => (s === 'null' || s === '' ? null : s))

export const GameSchema = z.object({
  id: z.number(),
  player_red_1: playerName,
  player_red_2: playerName,
  player_blue_1: playerName,
  player_blue_2: playerName,
  lastUpdated: z.string(),
  match_winner: z.string(),
  winning_table: z.number(),
  points_at_stake: z.number(),
})

export const GameListSchema = z.array(GameSchema)

export type Game = z.infer<typeof GameSchema>

// POST /games/ returns { newGameIDs: ["88"] } today. Validating the response
// at runtime catches contract drift (e.g. backend switching to plain text per
// the broader response-format inconsistency tracked in FINDINGS-backend.md)
// instead of silently propagating undefined to the success callback.
export const ReportGameResponseSchema = z.object({
  newGameIDs: z.array(z.string()),
})

// Period is canonically exported from @/lib/period. Re-export for callers
// that already pull other types from this module.
export type { Period } from '@/lib/period'

export type Side = 'red' | 'blue' | 'tie' | 'unknown'

export const winnerSide = (winner: string): Side => {
  const w = winner.toLowerCase()
  if (w.includes('red') || w.includes('rød')) return 'red'
  if (w.includes('blue') || w.includes('blå')) return 'blue'
  if (w.includes('tie') || w.includes('draw') || w.includes('uafgjort')) return 'tie'
  return 'unknown'
}
