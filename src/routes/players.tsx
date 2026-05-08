import { createFileRoute } from '@tanstack/react-router'
import { PlayersList } from '@/features/players/PlayersList'
import { lastPlayedQuery, playersQuery } from '@/features/players/usePlayers'

const PlayersPage = () => {
  return <PlayersList />
}

export const Route = createFileRoute('/players')({
  loader: ({ context: { queryClient } }) =>
    Promise.all([
      queryClient.ensureQueryData(playersQuery),
      queryClient.ensureQueryData(lastPlayedQuery),
    ]),
  component: PlayersPage,
})
