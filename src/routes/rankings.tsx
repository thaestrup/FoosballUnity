import { createFileRoute } from '@tanstack/react-router'
import { RankingsList } from '@/features/rankings/RankingsList'
import { rankingsQuery } from '@/features/rankings/useRankings'

const RankingsPage = () => {
  return <RankingsList />
}

export const Route = createFileRoute('/rankings')({
  loader: ({ context: { queryClient } }) =>
    queryClient.ensureQueryData(rankingsQuery('alltime')),
  component: RankingsPage,
})
