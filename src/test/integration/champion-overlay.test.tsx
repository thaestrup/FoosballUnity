import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
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

describe('integration: champion overlay appears after leader change', () => {
  it('shows the "🏆 New leader" overlay with the new leader on the gold step when alltime top changes after a report', async () => {
    let alltimeFetchCount = 0
    // Pre-seed alltime: A is leader. After the first refetch (post-report),
    // return B as the new leader so the top-set comparison fires the overlay.
    const beforeReport = [
      { name: 'A', points: 1700, position: 1, numberOfGames: 10 },
      { name: 'B', points: 1500, position: 2, numberOfGames: 10 },
      { name: 'C', points: 1400, position: 3, numberOfGames: 10 },
    ]
    const afterReport = [
      { name: 'B', points: 1900, position: 1, numberOfGames: 11 },
      { name: 'A', points: 1700, position: 2, numberOfGames: 10 },
      { name: 'C', points: 1400, position: 3, numberOfGames: 10 },
    ]

    server.use(
      http.get(`${BASE}/players/`, () =>
        HttpResponse.json([
          { name: 'A', playerReady: true, oprettet: '2026-01-01 12:00:00.0', registeredRFIDTag: '' },
          { name: 'B', playerReady: true, oprettet: '2026-01-01 12:00:00.0', registeredRFIDTag: '' },
          { name: 'C', playerReady: true, oprettet: '2026-01-01 12:00:00.0', registeredRFIDTag: '' },
          { name: 'D', playerReady: true, oprettet: '2026-01-01 12:00:00.0', registeredRFIDTag: '' },
        ]),
      ),
      http.post(`${BASE}/tournament/awesomeAlgorithmTournament/`, () =>
        HttpResponse.json([
          {
            tournamentGames: [
              {
                player_red_1: 'B',
                player_red_2: 'D',
                player_blue_1: 'A',
                player_blue_2: 'C',
              },
            ],
          },
        ]),
      ),
      http.post(`${BASE}/games/`, () =>
        HttpResponse.json({ newGameIDs: ['100'] }),
      ),
      http.get(`${BASE}/pointsPrPlayer/:period`, ({ params }) => {
        if (params.period !== 'alltime') return HttpResponse.json([])
        alltimeFetchCount++
        // Switch payload after the first fetch so the second fetch returns
        // the new leader.
        return HttpResponse.json(alltimeFetchCount === 1 ? beforeReport : afterReport)
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

    // Generate the board so we have something to report.
    const generate = await screen.findByRole('button', { name: /^Generate$/ })
    await user.click(generate)

    // Click the red-team-won button to trigger a POST /games/ → invalidate
    // ['rankings'] → refetch /pointsPrPlayer/alltime → leader change → overlay.
    const greenBtn = await screen.findByRole('button', { name: /Green won/i })
    await user.click(greenBtn)

    // Overlay appears.
    const overlay = await screen.findByRole('dialog', { name: /New leader/i })
    expect(overlay).toHaveTextContent(/🏆 New leader/)

    // B should occupy the gold step (place 1).
    // Dom order in ChampionOverlay is [silver(2), gold(1), bronze(3)] —
    // assert via the platform numbers + names colocation.
    const goldStep = overlay.querySelector('.step_1')
    expect(goldStep).not.toBeNull()
    expect(goldStep!).toHaveTextContent('B')
    expect(goldStep!).toHaveTextContent('1900')
  })
})
