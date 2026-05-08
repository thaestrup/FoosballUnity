import { createFileRoute } from '@tanstack/react-router'
import { PlayerDetail } from '@/features/players/PlayerDetail'
import { gamesByPlayerQuery } from '@/features/games/useGames'

const PlayerDetailPage = () => {
  const { name } = Route.useParams()
  return <PlayerDetail name={name} />
}

export const Route = createFileRoute('/player/$name')({
  loader: ({ params, context: { queryClient } }) =>
    queryClient.ensureQueryData(gamesByPlayerQuery(params.name)),
  component: PlayerDetailPage,
})
