import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'
import { GamesList } from '@/features/games/GamesList'
import { gamesQuery } from '@/features/games/useGames'

const SearchSchema = z.object({
  red1: z.string().optional(),
  red2: z.string().optional(),
  blue1: z.string().optional(),
  blue2: z.string().optional(),
})

const GamesPage = () => {
  const search = Route.useSearch()
  const prefill =
    search.red1 && search.red2 && search.blue1 && search.blue2
      ? {
          red1: search.red1,
          red2: search.red2,
          blue1: search.blue1,
          blue2: search.blue2,
        }
      : null

  return <GamesList prefill={prefill} />
}

export const Route = createFileRoute('/games')({
  validateSearch: SearchSchema,
  loader: ({ context: { queryClient } }) => queryClient.ensureQueryData(gamesQuery('week')),
  component: GamesPage,
})
