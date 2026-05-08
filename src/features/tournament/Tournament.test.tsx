import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { renderWithProviders } from '@/test/render'
import { makePlayer, makeRankingItem, resetFactoryIds } from '@/test/factories'

// Stub canvas-confetti so the celebrate() call from Tournament's useEffect
// doesn't try to do anything in jsdom.
vi.mock('canvas-confetti', () => ({ default: vi.fn() }))

// Audio() is constructed inside Tournament's useMemo. jsdom does provide a
// constructor, but the play()/load() implementations don't actually decode
// anything — silence them anyway so we never have to worry about pending
// promises or unhandled rejections.
beforeEach(() => {
  vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined)
  vi.spyOn(window.HTMLMediaElement.prototype, 'load').mockImplementation(() => {})

  // <dialog> isn't used by Tournament directly today, but the spec asks us to
  // stub it defensively in case ChampionOverlay (rendered into the same tree)
  // ever switches to a native dialog.
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.open = true
    })
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false
    })
  }

  resetFactoryIds()
})

afterEach(() => {
  vi.restoreAllMocks()
  vi.useRealTimers()
  // useStoredJSON keeps a process-wide cache; clearing sessionStorage by
  // itself isn't enough. Reset modules so the cache is fresh next test.
  window.sessionStorage.clear()
  vi.resetModules()
})

const BASE = 'http://localhost:5050'

const fourReadyPlayers = [
  makePlayer({ name: 'Lars', playerReady: true }),
  makePlayer({ name: 'Joan', playerReady: true }),
  makePlayer({ name: 'Frank', playerReady: true }),
  makePlayer({ name: 'Daniel', playerReady: true }),
]

const importTournament = async () => {
  // Always re-import so useStoredJSON's module-level cache resets between
  // tests. Returns a fresh component.
  const mod = await import('./Tournament')
  return mod.Tournament
}

describe('Tournament — empty state', () => {
  it('renders the "mark players ready" hint when no rounds have been generated', async () => {
    server.use(
      http.get(`${BASE}/players/`, () => HttpResponse.json([])),
      http.get(`${BASE}/pointsPrPlayer/alltime`, () => HttpResponse.json([])),
    )

    const Tournament = await importTournament()
    renderWithProviders(<Tournament />)

    expect(
      await screen.findByText(/Use the controls to generate a set of pairings/i),
    ).toBeInTheDocument()
  })

  it('shows the warning when fewer than 4 ready players', async () => {
    server.use(
      http.get(`${BASE}/players/`, () =>
        HttpResponse.json([
          makePlayer({ name: 'Lars', playerReady: true }),
          makePlayer({ name: 'Joan', playerReady: true }),
        ]),
      ),
      http.get(`${BASE}/pointsPrPlayer/alltime`, () => HttpResponse.json([])),
    )

    const Tournament = await importTournament()
    renderWithProviders(<Tournament />)

    expect(
      await screen.findByText(/Need at least 4 ready players/i),
    ).toBeInTheDocument()
    const generateBtn = screen.getByRole('button', { name: /Generate/i })
    expect(generateBtn).toBeDisabled()
  })

  it('matches snapshot when no rounds have been generated', async () => {
    server.use(
      http.get(`${BASE}/players/`, () => HttpResponse.json([])),
      http.get(`${BASE}/pointsPrPlayer/alltime`, () => HttpResponse.json([])),
    )

    const Tournament = await importTournament()
    const { container } = renderWithProviders(<Tournament />)
    await screen.findByText(/Use the controls to generate a set of pairings/i)
    expect(container.firstChild).toMatchSnapshot()
  })
})

describe('Tournament — accordion toggle', () => {
  it('opens the "Tournament options" accordion to reveal the algorithm picker', async () => {
    const user = userEvent.setup()
    server.use(
      http.get(`${BASE}/players/`, () => HttpResponse.json(fourReadyPlayers)),
      http.get(`${BASE}/pointsPrPlayer/alltime`, () => HttpResponse.json([])),
    )

    const Tournament = await importTournament()
    renderWithProviders(<Tournament />)

    const summary = await screen.findByText('Tournament options')
    const detailsEl = summary.closest('details') as HTMLDetailsElement
    expect(detailsEl.open).toBe(false)

    await user.click(summary)
    expect(detailsEl.open).toBe(true)

    // Algorithm picker now visible inside the accordion.
    const select = screen.getByLabelText('Algorithm') as HTMLSelectElement
    expect(select.value).toBe('awesomeAlgorithmTournament')
  })
})

describe('Tournament — generate flow', () => {
  it('POSTs to /tournament/awesomeAlgorithmTournament/ by default', async () => {
    const user = userEvent.setup()
    const calls: string[] = []
    server.use(
      http.get(`${BASE}/players/`, () => HttpResponse.json(fourReadyPlayers)),
      http.get(`${BASE}/pointsPrPlayer/alltime`, () => HttpResponse.json([])),
      http.post(`${BASE}/tournament/awesomeAlgorithmTournament/`, () => {
        calls.push('awesome')
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

    const Tournament = await importTournament()
    renderWithProviders(<Tournament />)

    const generateBtn = await screen.findByRole('button', { name: 'Generate' })
    await waitFor(() => expect(generateBtn).not.toBeDisabled())
    await user.click(generateBtn)

    await waitFor(() => expect(calls).toEqual(['awesome']))
  })

  it('switches algorithms via the dropdown and POSTs to the new endpoint', async () => {
    const user = userEvent.setup()
    const calls: string[] = []
    server.use(
      http.get(`${BASE}/players/`, () => HttpResponse.json(fourReadyPlayers)),
      http.get(`${BASE}/pointsPrPlayer/alltime`, () => HttpResponse.json([])),
      http.post(`${BASE}/tournament/awesomeAlgorithmTournament/`, () => {
        calls.push('awesome')
        return HttpResponse.json([{ tournamentGames: [] }])
      }),
      http.post(`${BASE}/tournament/randomTournament/`, () => {
        calls.push('random')
        return HttpResponse.json([
          {
            player_red_1: 'Lars',
            player_red_2: 'Joan',
            player_blue_1: 'Frank',
            player_blue_2: 'Daniel',
          },
        ])
      }),
      http.post(`${BASE}/tournament/lastFirstTournament/`, () => {
        calls.push('lastFirst')
        return HttpResponse.json([{ tournamentGames: [] }])
      }),
    )

    const Tournament = await importTournament()
    renderWithProviders(<Tournament />)

    // First generate uses the default.
    const generateBtn = await screen.findByRole('button', { name: 'Generate' })
    await waitFor(() => expect(generateBtn).not.toBeDisabled())
    await user.click(generateBtn)
    await waitFor(() => expect(calls).toEqual(['awesome']))

    // Open the accordion and switch algorithm.
    const summary = screen.getByText('Tournament options')
    await user.click(summary)
    const select = screen.getByLabelText('Algorithm') as HTMLSelectElement
    await user.selectOptions(select, 'randomTournament')

    await user.click(screen.getByRole('button', { name: 'Generate' }))
    await waitFor(() => expect(calls).toEqual(['awesome', 'random']))
  })
})

describe('Tournament — champion overlay', () => {
  it('shows the champion overlay when the alltime top set changes after a refetch', async () => {
    server.use(
      http.get(`${BASE}/players/`, () => HttpResponse.json([])),
      http.get(`${BASE}/pointsPrPlayer/alltime`, () =>
        HttpResponse.json([
          makeRankingItem({ name: 'OldKing', points: 1700, position: 1 }),
          makeRankingItem({ name: 'B', points: 1600, position: 2 }),
          makeRankingItem({ name: 'C', points: 1550, position: 3 }),
        ]),
      ),
    )

    const Tournament = await importTournament()
    const { queryClient } = renderWithProviders(<Tournament />)

    // Wait for the initial rankings query so the previous-top ref gets seeded.
    await waitFor(() =>
      expect(queryClient.getQueryData(['rankings', 'alltime'])).toBeDefined(),
    )

    // Now swap the handler and invalidate to trigger a re-fetch with a new top.
    server.use(
      http.get(`${BASE}/pointsPrPlayer/alltime`, () =>
        HttpResponse.json([
          makeRankingItem({ name: 'NewKing', points: 1800, position: 1 }),
          makeRankingItem({ name: 'OldKing', points: 1700, position: 2 }),
          makeRankingItem({ name: 'B', points: 1600, position: 3 }),
        ]),
      ),
    )

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['rankings', 'alltime'] })
    })

    // Overlay appears with the new champion on top.
    const dialog = await screen.findByRole('dialog', { name: /new leader/i })
    expect(dialog).toBeInTheDocument()
    // 'NewKing' might also appear in the SidebarRankings list — assert
    // specifically against the dialog's contents.
    expect(within(dialog).getByText('NewKing')).toBeInTheDocument()
  })

  it('does NOT show the overlay when the top set is unchanged across refetches', async () => {
    server.use(
      http.get(`${BASE}/players/`, () => HttpResponse.json([])),
      http.get(`${BASE}/pointsPrPlayer/alltime`, () =>
        HttpResponse.json([
          makeRankingItem({ name: 'Same', points: 1700, position: 1 }),
          makeRankingItem({ name: 'B', points: 1600, position: 2 }),
        ]),
      ),
    )

    const Tournament = await importTournament()
    const { queryClient } = renderWithProviders(<Tournament />)

    await waitFor(() =>
      expect(queryClient.getQueryData(['rankings', 'alltime'])).toBeDefined(),
    )

    await act(async () => {
      await queryClient.invalidateQueries({ queryKey: ['rankings', 'alltime'] })
    })

    // Settle then assert — give effect a microtask.
    await new Promise((r) => setTimeout(r, 0))
    expect(screen.queryByRole('dialog', { name: /new leader/i })).not.toBeInTheDocument()
  })

  it('auto-dismisses the overlay after 5 s', async () => {
    // Install fake timers from the start so ChampionOverlay's setTimeout is
    // captured. We use { shouldAdvanceTime: true } so MSW/React-Query's
    // microtask plumbing keeps moving forward without manual prodding.
    vi.useFakeTimers({ shouldAdvanceTime: true })

    server.use(
      http.get(`${BASE}/players/`, () => HttpResponse.json([])),
    )

    const Tournament = await importTournament()
    const { queryClient } = renderWithProviders(<Tournament />, {
      preloadedQueries: {
        [JSON.stringify(['rankings', 'alltime'])]: [
          makeRankingItem({ name: 'OldKing', points: 1700, position: 1 }),
        ],
      },
    })

    // Switch the top so the effect fires and the overlay renders.
    await act(async () => {
      queryClient.setQueryData(['rankings', 'alltime'], [
        makeRankingItem({ name: 'NewKing', points: 1800, position: 1 }),
      ])
    })

    const dialog = await screen.findByRole('dialog', { name: /new leader/i })
    expect(dialog).toBeInTheDocument()

    // Advance past the 5s auto-dismiss threshold.
    await act(async () => {
      vi.advanceTimersByTime(5001)
    })

    expect(
      screen.queryByRole('dialog', { name: /new leader/i }),
    ).not.toBeInTheDocument()
  })
})
