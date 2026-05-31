import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, api } from '@/lib/api'
import { getBackendUrl } from '@/lib/backendUrl'
import { bumpPhotoVersion } from '@/lib/playerPhoto'
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

export const useRenamePlayer = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      oldName,
      newName,
    }: {
      oldName: string
      newName: string
    }) =>
      api(`/players/${encodeURIComponent(oldName)}/rename`, {
        method: 'PUT',
        body: JSON.stringify({ newName }),
      }),
    onSuccess: (_data, { oldName, newName }) => {
      void qc.invalidateQueries({ queryKey: playersQuery.queryKey })
      // Player name appears denormalized in tbl_fights, so games + rankings
      // need a refetch. The backend cascade keeps history consistent — we
      // just need clients to pull the new copy.
      void qc.invalidateQueries({ queryKey: ['games'] })
      void qc.invalidateQueries({ queryKey: ['rankings'] })
      // Avatar of the renamed player is also affected: with the new name
      // its <img src> path changes, but the old name's cached entry could
      // linger if any other view still references it. Bump both.
      bumpPhotoVersion(oldName)
      bumpPhotoVersion(newName)
    },
  })
}

// Phone photos from the file picker are usually 2-5 MB; the backend rejects
// > 2 MB with 413. Resize to 512px max-edge JPEG @ 0.85 quality — typical
// output ~50 KB and still readable as a head-shot.
const MAX_PHOTO_EDGE = 512
const PHOTO_QUALITY = 0.85

const resizePhotoForUpload = async (file: File): Promise<File> => {
  // OffscreenCanvas + createImageBitmap is available everywhere modern
  // (jsdom doesn't have it, but tests stub or mock this path).
  if (
    typeof createImageBitmap !== 'function' ||
    typeof OffscreenCanvas === 'undefined'
  ) {
    return file
  }
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(
    MAX_PHOTO_EDGE / bitmap.width,
    MAX_PHOTO_EDGE / bitmap.height,
    1,
  )
  const width = Math.round(bitmap.width * scale)
  const height = Math.round(bitmap.height * scale)
  const canvas = new OffscreenCanvas(width, height)
  const ctx = canvas.getContext('2d')
  if (!ctx) return file
  ctx.drawImage(bitmap, 0, 0, width, height)
  const blob = await canvas.convertToBlob({
    type: 'image/jpeg',
    quality: PHOTO_QUALITY,
  })
  return new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), {
    type: 'image/jpeg',
  })
}

export const useUploadPhoto = () => {
  return useMutation({
    mutationFn: async ({ name, file }: { name: string; file: File }) => {
      const resized = await resizePhotoForUpload(file)
      const res = await fetch(
        `${getBackendUrl()}/players/${encodeURIComponent(name)}/photo`,
        {
          method: 'PUT',
          // Raw bytes per backend contract (NOT multipart). Browser sets
          // Content-Length automatically; we set the image MIME explicitly.
          headers: { 'Content-Type': resized.type },
          body: resized,
        },
      )
      if (!res.ok) {
        throw new ApiError(
          `PUT /players/${name}/photo → ${res.status}`,
          res.status,
        )
      }
    },
    onSuccess: (_data, { name }) => {
      // Force every mounted <Avatar name={name}> to reload (the server
      // caches with Cache-Control: private, max-age=60, so a query-string
      // version bust is the only way to skip the stale browser entry).
      bumpPhotoVersion(name)
    },
  })
}

export const useDeletePhoto = () => {
  return useMutation({
    mutationFn: (name: string) =>
      api(`/players/${encodeURIComponent(name)}/photo`, { method: 'DELETE' }),
    onSuccess: (_data, name) => {
      bumpPhotoVersion(name)
    },
  })
}

// Hard delete a player. Cascades to the photo row server-side; historical
// games keep their name strings since tbl_fights stores names verbatim.
export const useDeletePlayer = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (name: string) =>
      api(`/players/${encodeURIComponent(name)}`, { method: 'DELETE' }),
    onSuccess: (_data, name) => {
      void qc.invalidateQueries({ queryKey: playersQuery.queryKey })
      // Games still reference this player by name in history; rankings
      // recompute. Bump the photo version too so any cached <img> 404s
      // immediately instead of riding out the 60s Cache-Control window.
      void qc.invalidateQueries({ queryKey: ['games'] })
      void qc.invalidateQueries({ queryKey: ['rankings'] })
      bumpPhotoVersion(name)
    },
  })
}
