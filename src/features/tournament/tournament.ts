import { z } from 'zod'

// Backend writes the literal string "null" (Groovy concat) for unfilled
// wildcard slots when the player count doesn't divide evenly into 4-per-game.
// Normalize at parse time so consumers see actual JS null. Mirrors the
// playerName transform in features/games/game.ts — same backend quirk, same fix.
const playerName = z
  .union([z.string(), z.null()])
  .transform((s) => (s === 'null' || s === '' ? null : s))

export const TournamentGameSchema = z.object({
  player_red_1: playerName,
  player_red_2: playerName,
  player_blue_1: playerName,
  player_blue_2: playerName,
})

export const TournamentRoundSchema = z.object({
  tournamentGames: z.array(TournamentGameSchema),
})

export const FlatTournamentSchema = z.array(TournamentGameSchema)
export const RoundedTournamentSchema = z.array(TournamentRoundSchema)

export type TournamentGame = z.infer<typeof TournamentGameSchema>
export type TournamentRound = { games: TournamentGame[] }

export type Algorithm =
  | 'randomTournament'
  | 'lastFirstTournament'
  | 'awesomeAlgorithmTournament'

export const ALGORITHMS: Array<{ key: Algorithm; label: string; description: string }> = [
  {
    key: 'randomTournament',
    label: 'Random',
    description: 'Random pairings ignoring history',
  },
  {
    key: 'lastFirstTournament',
    label: 'Last-first',
    description: 'Prefer pairings the players have least recently played',
  },
  {
    key: 'awesomeAlgorithmTournament',
    label: 'Awesome',
    description: 'Mix of pairings, history and ELO balancing',
  },
]
