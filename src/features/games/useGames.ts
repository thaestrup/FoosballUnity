import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { nowDbTimestamp } from '@/lib/time'
import {
  GameListSchema,
  GameSchema,
  ReportGameResponseSchema,
  type Game,
  type Period,
} from './game'

export const gamesQuery = (period: Period) =>
  queryOptions({
    queryKey: ['games', period],
    queryFn: async () => {
      const data = await api<unknown>(`/games/${period}`)
      return GameListSchema.parse(data)
    },
  })

export const useGames = (period: Period) => {
  return useQuery(gamesQuery(period))
}

export const gamesByPlayerQuery = (name: string) =>
  queryOptions({
    queryKey: ['games', 'byPlayer', name],
    queryFn: async () => {
      const data = await api<unknown>(`/games/${encodeURIComponent(name)}`)
      return GameListSchema.parse(data)
    },
  })

export const useGamesByPlayer = (name: string) => {
  return useQuery(gamesByPlayerQuery(name))
}

export type ReportGameInput = {
  red1: string | null
  red2: string | null
  blue1: string | null
  blue2: string | null
  winner: 'red' | 'blue' | 'draw'
  points: number
  table: number
}

const invalidateGameDerivedQueries = (qc: ReturnType<typeof useQueryClient>) => {
  void qc.invalidateQueries({ queryKey: ['games'] })
  void qc.invalidateQueries({ queryKey: ['rankings'] })
  void qc.invalidateQueries({ queryKey: ['statisticsPlayersLastPlayed'] })
}

export const useReportGame = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (input: ReportGameInput) => {
      const game = {
        player_red_1: input.red1,
        player_red_2: input.red2,
        player_blue_1: input.blue1,
        player_blue_2: input.blue2,
        lastUpdated: nowDbTimestamp(),
        match_winner: input.winner,
        points_at_stake: input.points,
        winning_table: input.table,
      }
      const data = await api<unknown>('/games/', {
        method: 'POST',
        body: JSON.stringify([game]),
      })
      return ReportGameResponseSchema.parse(data)
    },
    onSuccess: () => invalidateGameDerivedQueries(qc),
  })
}

export const useClearAllGames = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api('/games/', { method: 'DELETE' }),
    onSuccess: () => invalidateGameDerivedQueries(qc),
  })
}

// Server contract: `id` and `lastUpdated` in the body are ignored — id is
// taken from the path, lastUpdated is preserved from the existing row.
// We still send both to satisfy the GameDto shape on the wire.
export type UpdateGamePayload = {
  id: number
  player_red_1: string | null
  player_red_2: string | null
  player_blue_1: string | null
  player_blue_2: string | null
  match_winner: string
  points_at_stake: number
  winning_table: number
}

export const useUpdateGame = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (payload: UpdateGamePayload): Promise<Game> => {
      const { id, ...rest } = payload
      const body = { id, lastUpdated: nowDbTimestamp(), ...rest }
      const data = await api<unknown>(`/games/${id}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      })
      // Backend returns the updated GameDto as JSON; parse it through the
      // same schema so the "null"-string transform stays consistent.
      return GameSchema.parse(data)
    },
    onSuccess: () => invalidateGameDerivedQueries(qc),
  })
}

// Note: deliberately does NOT invalidate on success. The GamesList
// caller wants to run a fade-out animation between "backend confirmed
// delete" and "row actually unmounts", so it invalidates manually after
// the animation completes. If a future caller doesn't need that, it can
// call invalidateGameDerivedQueries from its own onSuccess.
export const useDeleteGame = () => {
  return useMutation({
    mutationFn: (id: number) => api(`/games/${id}`, { method: 'DELETE' }),
  })
}

export const invalidateGameDerivedQueriesFor = (
  qc: ReturnType<typeof useQueryClient>,
) => invalidateGameDerivedQueries(qc)
