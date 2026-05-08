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

describe('integration: tournament report-board flow', () => {
  it('POSTs /games/ with computed stakes for the red side, then refetches /pointsPrPlayer/alltime', async () => {
    const captured: Array<unknown> = []
    let alltimeFetchCount = 0

    server.use(
      // 4 ready players for the generate step.
      http.get(`${BASE}/players/`, () =>
        HttpResponse.json([
          { name: 'Lars', playerReady: true, oprettet: '2026-01-01 12:00:00.0', registeredRFIDTag: '' },
          { name: 'Joan', playerReady: true, oprettet: '2026-01-01 12:00:00.0', registeredRFIDTag: '' },
          { name: 'Frank', playerReady: true, oprettet: '2026-01-01 12:00:00.0', registeredRFIDTag: '' },
          { name: 'Daniel', playerReady: true, oprettet: '2026-01-01 12:00:00.0', registeredRFIDTag: '' },
        ]),
      ),
      // One board, evenly matched (no rankings → both teams default to 1500
      // each, K=50, so red and blue stakes both equal 25).
      http.post(`${BASE}/tournament/awesomeAlgorithmTournament/`, () =>
        HttpResponse.json([
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
        ]),
      ),
      http.post(`${BASE}/games/`, async ({ request }) => {
        captured.push(await request.json())
        return HttpResponse.json({ newGameIDs: ['77'] })
      }),
      http.get(`${BASE}/pointsPrPlayer/:period`, ({ params }) => {
        if (params.period === 'alltime') alltimeFetchCount++
        return HttpResponse.json([])
      }),
    )

    const preloadedQueries = {
      [JSON.stringify(['configuration'])]: [
        { name: 'numberOfTables', value: '1' },
        { name: 'nameTable1', value: 'Fort Nordjylland' },
      ],
      [JSON.stringify(['timer'])]: { id: 1, lastRequestedTimerStart: '2026-05-01 12:00:00.0' },
    }

    const user = userEvent.setup()
    renderWithProviders(<Tournament />, { preloadedQueries })

    // Generate the board.
    const generate = await screen.findByRole('button', { name: /^Generate$/ })
    await user.click(generate)

    // Wait for the active boards to render (the "Green won" button gives it
    // away — palette index 0 is Green/Red).
    const greenBtn = await screen.findByRole('button', { name: /Green won/i })

    // Snapshot the alltime fetch count BEFORE clicking the winner so we can
    // assert it goes up after the report.
    const beforeReport = alltimeFetchCount

    await user.click(greenBtn)

    // POST /games/ captured.
    await waitFor(() => expect(captured).toHaveLength(1))
    const body = captured[0] as Array<Record<string, unknown>>
    expect(body).toHaveLength(1)
    expect(body[0]).toMatchObject({
      player_red_1: 'Lars',
      player_red_2: 'Joan',
      player_blue_1: 'Frank',
      player_blue_2: 'Daniel',
      match_winner: 'red',
    })
    // points_at_stake is computed via ELO; with all unranked players (each
    // defaulting to 1500) and K=50 the red side gets 25 — non-zero.
    expect(typeof body[0].points_at_stake).toBe('number')
    expect(body[0].points_at_stake).toBeGreaterThan(0)

    // Reported badge appears once mutation settles.
    await screen.findByText(/Reported/)

    // The success handler invalidates ['rankings'] which triggers a refetch
    // of GET /pointsPrPlayer/alltime — assert via call counter.
    await waitFor(() => expect(alltimeFetchCount).toBeGreaterThan(beforeReport))
  })
})
