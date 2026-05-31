import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { renderWithProviders } from '@/test/render'
import { installAllShims } from '@/test/shims'
import { makePlayer, resetFactoryIds } from '@/test/factories'
import { PlayersList } from '@/features/players/PlayersList'
import { SelectedFacepile } from '@/features/players/SelectedFacepile'

const BASE = 'http://localhost:5050'

beforeEach(() => {
  resetFactoryIds()
  installAllShims()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('integration: add player flow', () => {
  it('POSTs the new player and shows them in the list and SelectedFacepile (since they are added ready)', async () => {
    const user = userEvent.setup()

    const posted: Array<unknown> = []
    let newbieAdded = false

    // GET returns Newbie ONLY after the POST has been observed. Counting
    // GET calls is unreliable because the form unconditionally refetches on
    // mount (staleTime: 0) and would falsely trigger the "already on the
    // list" duplicate guard before submission.
    server.use(
      http.get(`${BASE}/players/`, () => {
        const players = [
          makePlayer({ name: 'Lars', playerReady: true }),
          makePlayer({ name: 'Joan', playerReady: false }),
        ]
        if (newbieAdded) {
          players.push(makePlayer({ name: 'Newbie', playerReady: true }))
        }
        return HttpResponse.json(players)
      }),
      http.post(`${BASE}/players/`, async ({ request }) => {
        posted.push(await request.json())
        newbieAdded = true
        return HttpResponse.text('insertPlayer: Newbie, result: 1')
      }),
    )

    renderWithProviders(
      <>
        <SelectedFacepile />
        <PlayersList />
      </>,
    )

    await screen.findByText('Lars')

    // Open the FAB → dialog and submit a new player.
    await user.click(screen.getByRole('button', { name: 'Add player' }))
    const input = await screen.findByPlaceholderText('Player name')
    await user.type(input, 'Newbie')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    // Server captured the POST.
    await waitFor(() => expect(posted).toHaveLength(1))
    const body = posted[0] as Array<{ name: string; playerReady: boolean }>
    expect(body[0]).toMatchObject({ name: 'Newbie', playerReady: true })

    // After the invalidation-driven refetch the new player is rendered.
    await screen.findByText('Newbie')

    // The facepile shows the new player too — useQuery refetched and
    // playerReady=true means they are in the "selected" subset. Initially
    // only Lars was ready (Joan unselected). After Newbie is added (also
    // ready) the count goes from 1 → 2.
    await waitFor(() => {
      expect(screen.getByLabelText(/2 players ready/i)).toBeInTheDocument()
    })

    // And specifically Newbie's avatar should be in the facepile. The
    // backend photo URL is cache-busted with ?v=N so do a contains match.
    const facepile = screen.getByLabelText(/2 players ready/i)
    expect(
      facepile.querySelector('img[src*="/players/Newbie/photo"]'),
    ).not.toBeNull()
  })
})
