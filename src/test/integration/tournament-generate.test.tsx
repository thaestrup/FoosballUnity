import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { renderWithProviders } from '@/test/render'
import { installAllShims } from '@/test/shims'
import { Tournament } from '@/features/tournament/Tournament'

vi.mock('canvas-confetti', () => ({ default: vi.fn() }))

const BASE = 'http://localhost:5050'

beforeEach(() => {
  installAllShims()
  window.sessionStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  window.sessionStorage.clear()
})

describe('integration: tournament generate', () => {
  it('POSTs to the awesome algorithm with all 4 ready players and renders the boards', async () => {
    const captured: Array<{ algo: string; body: unknown }> = []

    server.use(
      // Need 4 ready players for canGenerate to be true; the default handler
      // only marks 2 as ready.
      http.get(`${BASE}/players/`, () =>
        HttpResponse.json([
          { name: 'Lars', playerReady: true, oprettet: '2026-01-01 12:00:00.0', registeredRFIDTag: '' },
          { name: 'Joan', playerReady: true, oprettet: '2026-01-01 12:00:00.0', registeredRFIDTag: '' },
          { name: 'Frank', playerReady: true, oprettet: '2026-01-01 12:00:00.0', registeredRFIDTag: '' },
          { name: 'Daniel', playerReady: true, oprettet: '2026-01-01 12:00:00.0', registeredRFIDTag: '' },
        ]),
      ),
      http.get(`${BASE}/configuration/`, () =>
        HttpResponse.json([
          { name: 'numberOfTables', value: '1' },
          { name: 'nameTable1', value: 'Fort Nordjylland' },
        ]),
      ),
      http.post(`${BASE}/tournament/:algo/`, async ({ request, params }) => {
        captured.push({
          algo: String(params.algo),
          body: await request.json(),
        })
        return HttpResponse.json([
          {
            tournamentGames: [
              {
                player_red_1: 'Lars',
                player_red_2: 'Joan',
                player_blue_1: 'Frank',
                player_blue_2: 'Daniel',
              },
            ],
          },
        ])
      }),
    )

    const preloadedQueries = {
      [JSON.stringify(['players'])]: [
        { name: 'Lars', playerReady: true, oprettet: '2026-01-01 12:00:00.0', registeredRFIDTag: '' },
        { name: 'Joan', playerReady: true, oprettet: '2026-01-01 12:00:00.0', registeredRFIDTag: '' },
        { name: 'Frank', playerReady: true, oprettet: '2026-01-01 12:00:00.0', registeredRFIDTag: '' },
        { name: 'Daniel', playerReady: true, oprettet: '2026-01-01 12:00:00.0', registeredRFIDTag: '' },
      ],
      [JSON.stringify(['configuration'])]: [
        { name: 'numberOfTables', value: '1' },
        { name: 'nameTable1', value: 'Fort Nordjylland' },
      ],
      [JSON.stringify(['timer'])]: { id: 1, lastRequestedTimerStart: '2026-05-01 12:00:00.0' },
      [JSON.stringify(['rankings', 'alltime'])]: [],
    }

    const user = userEvent.setup()
    renderWithProviders(<Tournament />, { preloadedQueries })

    const generate = await screen.findByRole('button', { name: /^Generate$/ })
    // Wait for the players query to land so the button is enabled.
    await waitFor(() => expect(generate).toBeEnabled())
    await user.click(generate)

    // Server captured the POST with the right shape.
    await waitFor(() => expect(captured).toHaveLength(1))
    expect(captured[0].algo).toBe('awesomeAlgorithmTournament')
    expect(captured[0].body).toMatchObject({
      numberOfGames: 1,
      players: [
        expect.objectContaining({ name: 'Lars', playerReady: true }),
        expect.objectContaining({ name: 'Joan', playerReady: true }),
        expect.objectContaining({ name: 'Frank', playerReady: true }),
        expect.objectContaining({ name: 'Daniel', playerReady: true }),
      ],
    })

    // ActiveBoards renders the pairing. Find the rendered board article
    // and assert all four players are inside it (avoiding false positives
    // from sidebar rankings, which may also list these names).
    const boardLabel = await screen.findByText('Fort Nordjylland')
    const board = boardLabel.closest('article')!
    expect(board).toHaveTextContent('Lars')
    expect(board).toHaveTextContent('Joan')
    expect(board).toHaveTextContent('Frank')
    expect(board).toHaveTextContent('Daniel')
  })
})
