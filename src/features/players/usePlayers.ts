import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { nowDbTimestamp } from '@/lib/time'
import { LastPlayedSchema, PlayerListSchema, type Player } from './player'

export const playersQuery = queryOptions({
  queryKey: ['players'],
  queryFn: async () => {
    const data = await api<unknown>('/players/')
    return PlayerListSchema.parse(data)
  },
})

export const lastPlayedQuery = queryOptions({
  queryKey: ['statisticsPlayersLastPlayed'],
  queryFn: async () => {
    const data = await api<unknown>('/statisticsPlayersLastPlayed/')
    return LastPlayedSchema.parse(data)
  },
})

export const usePlayers = () => {
  return useQuery(playersQuery)
}

export const useLastPlayed = () => {
  return useQuery(lastPlayedQuery)
}

const putPlayer = (p: Player) => {
  return api(`/players/${encodeURIComponent(p.name)}`, {
    method: 'PUT',
    body: JSON.stringify(p),
  })
}

export const useTogglePlayerReady = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (p: Player) => putPlayer({ ...p, playerReady: !p.playerReady }),
    onMutate: async (p) => {
      await qc.cancelQueries({ queryKey: playersQuery.queryKey })
      const prev = qc.getQueryData(playersQuery.queryKey)
      qc.setQueryData(playersQuery.queryKey, (old: Player[] | undefined) =>
        old?.map((x) => (x.name === p.name ? { ...x, playerReady: !x.playerReady } : x)),
      )
      return { prev }
    },
    onError: (_err, _p, ctx) => {
      if (ctx?.prev) qc.setQueryData(playersQuery.queryKey, ctx.prev)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: playersQuery.queryKey })
    },
  })
}

export const useSetAllPlayersReady = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ players, ready }: { players: Player[]; ready: boolean }) => {
      const toUpdate = players.filter((p) => p.playerReady !== ready)
      await Promise.all(toUpdate.map((p) => putPlayer({ ...p, playerReady: ready })))
    },
    // Mirror useTogglePlayerReady's optimistic+rollback shape so the bulk
    // "Select all" / "Clear all" UX is instantaneous even with N PUTs in
    // flight, and a partial server failure restores the prior cache state.
    onMutate: async ({ ready }) => {
      await qc.cancelQueries({ queryKey: playersQuery.queryKey })
      const prev = qc.getQueryData(playersQuery.queryKey)
      qc.setQueryData(playersQuery.queryKey, (old: Player[] | undefined) =>
        old?.map((p) => ({ ...p, playerReady: ready })),
      )
      return { prev }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev) qc.setQueryData(playersQuery.queryKey, ctx.prev)
    },
    onSettled: () => {
      void qc.invalidateQueries({ queryKey: playersQuery.queryKey })
    },
  })
}

export const useAddPlayer = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (input: { name: string; registeredRFIDTag?: string }) => {
      const player: Player = {
        name: input.name,
        playerReady: true,
        oprettet: nowDbTimestamp(),
        registeredRFIDTag: input.registeredRFIDTag ?? '',
      }
      return api('/players/', { method: 'POST', body: JSON.stringify([player]) })
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: playersQuery.queryKey })
    },
  })
}
