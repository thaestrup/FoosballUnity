import { z } from 'zod'

// Backend sends `null` for wildcard / unfilled slots when player count
// doesn't divide evenly into 4-per-game (e.g. 15 players, 4 boards).
export const TournamentGameSchema = z.object({
  player_red_1: z.string().nullable(),
  player_red_2: z.string().nullable(),
  player_blue_1: z.string().nullable(),
  player_blue_2: z.string().nullable(),
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
