import { useMutation } from '@tanstack/react-query'
import { api } from '@/lib/api'
import type { Player } from '@/features/players/player'
import {
  FlatTournamentSchema,
  RoundedTournamentSchema,
  type Algorithm,
  type TournamentRound,
} from './tournament'

type GenerateInput = {
  algorithm: Algorithm
  numberOfGames: number
  players: Player[]
}

export const useGenerateTournament = () => {
  return useMutation({
    mutationFn: async ({
      algorithm,
      numberOfGames,
      players,
    }: GenerateInput): Promise<TournamentRound[]> => {
      const data = await api<unknown>(`/tournament/${algorithm}/`, {
        method: 'POST',
        body: JSON.stringify({ numberOfGames, players }),
      })

      // randomTournament returns Game[] directly. The others return Round[].
      if (algorithm === 'randomTournament') {
        const games = FlatTournamentSchema.parse(data)
        return [{ games }]
      }

      const rounds = RoundedTournamentSchema.parse(data)
      return rounds.map((r) => ({ games: r.tournamentGames }))
    },
  })
}
