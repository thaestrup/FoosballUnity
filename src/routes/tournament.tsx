import { createFileRoute } from '@tanstack/react-router'
import { Tournament } from '@/features/tournament/Tournament'
import { configurationQuery } from '@/features/configuration/useConfiguration'
import { rankingsQuery } from '@/features/rankings/useRankings'

const TournamentPage = () => {
  return <Tournament />
}

export const Route = createFileRoute('/tournament')({
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(configurationQuery),
      queryClient.ensureQueryData(rankingsQuery('alltime')),
    ]),
  component: TournamentPage,
})
