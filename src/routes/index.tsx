import { createFileRoute } from '@tanstack/react-router'
import { Dashboard } from '@/features/dashboard/Dashboard'
import { rankingsQuery } from '@/features/rankings/useRankings'
import { gamesQuery } from '@/features/games/useGames'

const HomePage = () => {
  return <Dashboard />
}

export const Route = createFileRoute('/')({
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(rankingsQuery('alltime')),
      queryClient.ensureQueryData(gamesQuery('week')),
      queryClient.ensureQueryData(gamesQuery('day')),
    ]),
  component: HomePage,
})
