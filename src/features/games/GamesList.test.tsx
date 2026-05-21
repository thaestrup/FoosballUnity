import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '@/test/server'
import { renderWithProviders } from '@/test/render'
import { makeGame, makePlayer, resetFactoryIds } from '@/test/factories'
import { GamesList } from './GamesList'

const BASE = 'http://localhost:5050'

// jsdom doesn't implement <dialog>.showModal/close; the Dialog component
// crashes without these. Polyfill once for the whole file.
beforeAll(() => {
  if (!HTMLDialogElement.prototype.showModal) {
    HTMLDialogElement.prototype.showModal = function () {
      this.setAttribute('open', '')
    }
  }
  if (!HTMLDialogElement.prototype.close) {
    HTMLDialogElement.prototype.close = function () {
      this.removeAttribute('open')
      this.dispatchEvent(new Event('close'))
    }
  }
})

beforeEach(() => {
  resetFactoryIds()
  // TanStack Router calls window.scrollTo on transitions; jsdom doesn't
  // implement it. Stub silently so the warning noise doesn't pollute output.
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
})

afterEach(() => {
  vi.restoreAllMocks()
})

// Per-test default: prevent the 4 selects from defaulting to non-distinct
// players (the `useGames` factory makes 4 ready players to keep RHF defaults
// valid for ReportGameForm submissions).
const withFourReadyPlayers = () => {
  server.use(
    http.get(`${BASE}/players/`, () =>
      HttpResponse.json([
        makePlayer({ name: 'Lars', playerReady: true }),
        makePlayer({ name: 'Joan', playerReady: true }),
        makePlayer({ name: 'Frank', playerReady: true }),
        makePlayer({ name: 'Daniel', playerReady: true }),
      ]),
    ),
  )
}

describe('GamesList', () => {
  describe('rendering', () => {
    it('renders the list of games returned for the default (week) period', async () => {
      server.use(
        http.get(`${BASE}/games/week`, () =>
          HttpResponse.json([
            makeGame({
              id: 100,
              player_red_1: 'Lars',
              player_red_2: 'Joan',
              player_blue_1: 'Frank',
              player_blue_2: 'Daniel',
              match_winner: 'red',
              points_at_stake: 17,
            }),
          ]),
        ),
      )

      renderWithProviders(<GamesList />)

      expect(await screen.findByText('#100')).toBeInTheDocument()
      expect(screen.getByText('17 pts')).toBeInTheDocument()
      expect(screen.getByText('Lars & Joan')).toBeInTheDocument()
      expect(screen.getByText('Frank & Daniel')).toBeInTheDocument()
      expect(screen.getByText('Won')).toBeInTheDocument()
      expect(screen.getByText('Lost')).toBeInTheDocument()
    })

    it('renders the empty state when no games are returned', async () => {
      server.use(http.get(`${BASE}/games/week`, () => HttpResponse.json([])))

      renderWithProviders(<GamesList />)

      expect(
        await screen.findByText(/No games in this period/i),
      ).toBeInTheDocument()
      // Clear-all should be disabled when there are no games to clear.
      expect(
        screen.getByRole('button', { name: /Clear all games/i }),
      ).toBeDisabled()
    })

    it('shows an error message when the games query fails', async () => {
      server.use(
        http.get(`${BASE}/games/week`, () =>
          new HttpResponse('boom', { status: 500 }),
        ),
      )

      renderWithProviders(<GamesList />)

      expect(await screen.findByText(/Couldn't load games/i)).toBeInTheDocument()
    })

    it('renders the period buttons with "This week" marked current by default', async () => {
      renderWithProviders(<GamesList />)

      // Router needs a tick to resolve before the component renders.
      for (const label of ['Last hour', 'Today', 'This week', 'This month', 'All time']) {
        await screen.findByRole('button', { name: label })
      }
      expect(
        screen.getByRole('button', { name: 'This week' }),
      ).toHaveAttribute('aria-current', 'true')

      // Wait for the loading to settle so afterEach doesn't race.
      await screen.findByRole('article')
    })
  })

  describe('GameCard outcome rendering (indirect)', () => {
    it('shows "Won"/"Lost" for a red win', async () => {
      server.use(
        http.get(`${BASE}/games/week`, () =>
          HttpResponse.json([makeGame({ id: 1, match_winner: 'red' })]),
        ),
      )
      renderWithProviders(<GamesList />)

      expect(await screen.findByText('Won')).toBeInTheDocument()
      expect(screen.getByText('Lost')).toBeInTheDocument()
    })

    it('shows "Won"/"Lost" for a blue win', async () => {
      server.use(
        http.get(`${BASE}/games/week`, () =>
          HttpResponse.json([makeGame({ id: 2, match_winner: 'blue' })]),
        ),
      )
      renderWithProviders(<GamesList />)

      const article = await screen.findByRole('article')
      expect(within(article).getByText('Won')).toBeInTheDocument()
      expect(within(article).getByText('Lost')).toBeInTheDocument()
      // Verify which team gets which outcome via class.
      const redTeam = article.querySelector('.team_red')
      const blueTeam = article.querySelector('.team_blue')
      expect(redTeam).toHaveClass('outcome_loss')
      expect(blueTeam).toHaveClass('outcome_win')
    })

    it('shows "Tie" on both sides for a draw', async () => {
      server.use(
        http.get(`${BASE}/games/week`, () =>
          HttpResponse.json([makeGame({ id: 3, match_winner: 'draw' })]),
        ),
      )
      renderWithProviders(<GamesList />)

      const article = await screen.findByRole('article')
      const tieBadges = within(article).getAllByText('Tie')
      expect(tieBadges).toHaveLength(2)
    })

    it('renders neither badge for an unknown winner', async () => {
      server.use(
        http.get(`${BASE}/games/week`, () =>
          HttpResponse.json([makeGame({ id: 4, match_winner: 'mystery' })]),
        ),
      )
      renderWithProviders(<GamesList />)

      const article = await screen.findByRole('article')
      expect(within(article).queryByText(/^Won$/)).not.toBeInTheDocument()
      expect(within(article).queryByText(/^Lost$/)).not.toBeInTheDocument()
      expect(within(article).queryByText(/^Tie$/)).not.toBeInTheDocument()
    })

    it('renders "No players" when both slots are missing', async () => {
      server.use(
        http.get(`${BASE}/games/week`, () =>
          HttpResponse.json([
            makeGame({
              id: 5,
              player_red_1: null,
              player_red_2: null,
              match_winner: 'blue',
            }),
          ]),
        ),
      )
      renderWithProviders(<GamesList />)

      expect(await screen.findByText('No players')).toBeInTheDocument()
      expect(screen.getByText('Frank & Daniel')).toBeInTheDocument()
    })

    it('renders just the present name when one slot is missing', async () => {
      server.use(
        http.get(`${BASE}/games/week`, () =>
          HttpResponse.json([
            makeGame({
              id: 6,
              player_red_1: 'Lars',
              player_red_2: null,
              player_blue_1: 'Frank',
              player_blue_2: null,
              match_winner: 'red',
            }),
          ]),
        ),
      )
      renderWithProviders(<GamesList />)

      // Scope queries to the rendered card so we don't also pick up <option>
      // elements inside the (closed) report dialog form.
      const article = await screen.findByRole('article')
      expect(within(article).getByText('Lars')).toBeInTheDocument()
      expect(within(article).getByText('Frank')).toBeInTheDocument()
      // Should not have an "&" joining a missing player.
      expect(within(article).queryByText(/Lars &/i)).not.toBeInTheDocument()
    })

    it('treats backend "null" string as a missing slot (zod transform)', async () => {
      server.use(
        http.get(`${BASE}/games/week`, () =>
          HttpResponse.json([
            {
              id: 7,
              player_red_1: 'null',
              player_red_2: 'null',
              player_blue_1: 'Frank',
              player_blue_2: 'Daniel',
              lastUpdated: '2026-05-01 12:00:00.0',
              match_winner: 'blue',
              winning_table: 1,
              points_at_stake: 25,
            },
          ]),
        ),
      )
      renderWithProviders(<GamesList />)

      expect(await screen.findByText('No players')).toBeInTheDocument()
    })
  })

  describe('period tabs', () => {
    it('refetches and shows games for the clicked period', async () => {
      server.use(
        http.get(`${BASE}/games/week`, () =>
          HttpResponse.json([makeGame({ id: 11 })]),
        ),
        http.get(`${BASE}/games/month`, () =>
          HttpResponse.json([makeGame({ id: 22 })]),
        ),
      )

      const user = userEvent.setup()
      renderWithProviders(<GamesList />)

      expect(await screen.findByText('#11')).toBeInTheDocument()

      await user.click(screen.getByRole('button', { name: 'This month' }))

      expect(await screen.findByText('#22')).toBeInTheDocument()
      expect(screen.queryByText('#11')).not.toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'This month' })).toHaveAttribute(
        'aria-current',
        'true',
      )
    })

    it('hits the right endpoint for each period', async () => {
      const seen: string[] = []
      server.use(
        http.get(`${BASE}/games/:period`, ({ params }) => {
          seen.push(params.period as string)
          return HttpResponse.json([])
        }),
      )

      const user = userEvent.setup()
      renderWithProviders(<GamesList />)

      // Initial load is for 'week'.
      await screen.findByText(/No games in this period/i)
      expect(seen).toContain('week')

      for (const label of ['Last hour', 'Today', 'This month', 'All time']) {
        await user.click(screen.getByRole('button', { name: label }))
        await screen.findByText(/No games in this period/i)
      }

      expect(seen).toEqual(
        expect.arrayContaining(['week', 'hour', 'day', 'month', 'alltime']),
      )
    })
  })

  describe('clear all games', () => {
    it('confirms and DELETEs /games/ when the user accepts', async () => {
      let deleteCount = 0
      server.use(
        http.get(`${BASE}/games/week`, () =>
          HttpResponse.json([makeGame({ id: 1 })]),
        ),
        http.delete(`${BASE}/games/`, () => {
          deleteCount++
          return HttpResponse.text('cleanGameTable: 1')
        }),
      )

      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true)
      const user = userEvent.setup()
      renderWithProviders(<GamesList />)

      const clear = await screen.findByRole('button', { name: /Clear all games/i })
      await user.click(clear)

      expect(confirmSpy).toHaveBeenCalledOnce()
      // Wait for the mutation to settle and re-fetch to land.
      await vi.waitFor(() => expect(deleteCount).toBe(1))
    })

    it('does NOT DELETE when the user declines the confirm', async () => {
      let deleteCount = 0
      server.use(
        http.get(`${BASE}/games/week`, () =>
          HttpResponse.json([makeGame({ id: 1 })]),
        ),
        http.delete(`${BASE}/games/`, () => {
          deleteCount++
          return HttpResponse.text('cleanGameTable: 1')
        }),
      )

      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false)
      const user = userEvent.setup()
      renderWithProviders(<GamesList />)

      const clear = await screen.findByRole('button', { name: /Clear all games/i })
      await user.click(clear)

      expect(confirmSpy).toHaveBeenCalledOnce()
      // Give any erroneous request a chance to fire.
      await new Promise((r) => setTimeout(r, 50))
      expect(deleteCount).toBe(0)
    })
  })

  describe('FAB → Dialog → ReportGameForm', () => {
    it('opens the report dialog when the FAB is clicked', async () => {
      withFourReadyPlayers()
      const user = userEvent.setup()
      const { container } = renderWithProviders(<GamesList />)

      // Wait for the games list to settle first.
      await screen.findByRole('article')

      // Sanity: the <dialog> starts closed (no `open` attribute).
      const dialog = container.querySelector('dialog')!
      expect(dialog.hasAttribute('open')).toBe(false)

      const fab = screen.getByRole('button', { name: 'Report game' })
      await user.click(fab)

      await vi.waitFor(() => expect(dialog.hasAttribute('open')).toBe(true))
      // The form's two action buttons (Report game submit + Cancel) are inside.
      expect(within(dialog).getByRole('button', { name: /^Cancel$/ })).toBeInTheDocument()
      expect(within(dialog).getByRole('button', { name: /^Report game$/ })).toBeInTheDocument()
    })

    it('submits a new game via POST /games/ when the form is submitted', async () => {
      withFourReadyPlayers()
      const captured: unknown[] = []
      server.use(
        http.post(`${BASE}/games/`, async ({ request }) => {
          captured.push(await request.json())
          return HttpResponse.json({ newGameIDs: ['42'] })
        }),
      )

      const user = userEvent.setup()
      const { container } = renderWithProviders(<GamesList />)

      await screen.findByRole('article')
      await user.click(screen.getByRole('button', { name: 'Report game' }))

      const dialog = container.querySelector('dialog')!
      await vi.waitFor(() => expect(dialog.hasAttribute('open')).toBe(true))

      // Wait for the player select options to populate (RHF needs the
      // `values` prop to flush before submitting will pass validation).
      await within(dialog).findAllByRole('option', { name: 'Lars' })

      const submitBtn = within(dialog).getByRole('button', { name: /^Report game$/ })
      await user.click(submitBtn)

      // Confirmation banner appears when onReported fires.
      expect(await screen.findByRole('status')).toHaveTextContent(
        /Reported as game #42/i,
      )

      expect(captured).toHaveLength(1)
      const body = captured[0] as Array<Record<string, unknown>>
      expect(body).toHaveLength(1)
      expect(body[0]).toMatchObject({
        player_red_1: 'Lars',
        player_red_2: 'Joan',
        player_blue_1: 'Frank',
        player_blue_2: 'Daniel',
        match_winner: 'red',
        points_at_stake: 1,
        winning_table: 1,
      })
      expect(typeof body[0].lastUpdated).toBe('string')
    })

    it('cancel button closes the dialog without submitting', async () => {
      withFourReadyPlayers()
      let postCount = 0
      server.use(
        http.post(`${BASE}/games/`, () => {
          postCount++
          return HttpResponse.json({ newGameIDs: ['1'] })
        }),
      )

      const user = userEvent.setup()
      const { container } = renderWithProviders(<GamesList />)

      await screen.findByRole('article')
      await user.click(screen.getByRole('button', { name: 'Report game' }))

      const dialog = container.querySelector('dialog')!
      await vi.waitFor(() => expect(dialog.hasAttribute('open')).toBe(true))

      const cancel = within(dialog).getByRole('button', { name: /^Cancel$/ })
      await user.click(cancel)

      await vi.waitFor(() => expect(dialog.hasAttribute('open')).toBe(false))
      expect(postCount).toBe(0)
    })
  })

  describe('search-param prefill', () => {
    it('auto-opens the dialog and submits the prefilled players', async () => {
      // RHF leaves <select>.value as '' until interaction (it seeds defaults
      // via ref, not via `selected`), so we verify the prefill propagates by
      // immediately submitting and inspecting the captured POST body.
      withFourReadyPlayers()
      const captured: unknown[] = []
      server.use(
        http.post(`${BASE}/games/`, async ({ request }) => {
          captured.push(await request.json())
          return HttpResponse.json({ newGameIDs: ['9'] })
        }),
      )

      const user = userEvent.setup()
      const { container } = renderWithProviders(
        <GamesList
          prefill={{ red1: 'Lars', red2: 'Joan', blue1: 'Frank', blue2: 'Daniel' }}
        />,
      )

      // Wait for the router/component to mount the dialog element.
      const dialog = await vi.waitFor(() => {
        const d = container.querySelector('dialog')
        if (!d) throw new Error('dialog not yet rendered')
        return d
      })
      // The dialog opens immediately because prefill !== null.
      await vi.waitFor(() => expect(dialog.hasAttribute('open')).toBe(true))

      // Wait for the player options to populate.
      await within(dialog).findAllByRole('option', { name: 'Lars' })

      const submit = within(dialog).getByRole('button', { name: /^Report game$/ })
      await user.click(submit)

      await vi.waitFor(() => expect(captured).toHaveLength(1))
      const body = captured[0] as Array<Record<string, unknown>>
      expect(body[0]).toMatchObject({
        player_red_1: 'Lars',
        player_red_2: 'Joan',
        player_blue_1: 'Frank',
        player_blue_2: 'Daniel',
      })
    })
  })

  describe('snapshots', () => {
    it('matches snapshot with games', async () => {
      server.use(
        http.get(`${BASE}/games/week`, () =>
          HttpResponse.json([
            makeGame({
              id: 100,
              player_red_1: 'Lars',
              player_red_2: 'Joan',
              player_blue_1: 'Frank',
              player_blue_2: 'Daniel',
              match_winner: 'red',
              lastUpdated: '2026-05-01 12:00:00.0',
              points_at_stake: 25,
            }),
          ]),
        ),
      )

      const { container } = renderWithProviders(<GamesList />)
      await screen.findByText('#100')
      // Replace the locale-dependent timestamp with a stable token.
      const time = container.querySelector('time')
      if (time) time.textContent = 'STABLE_TIMESTAMP'
      expect(container).toMatchSnapshot()
    })

    it('matches snapshot when empty', async () => {
      server.use(http.get(`${BASE}/games/week`, () => HttpResponse.json([])))
      const { container } = renderWithProviders(<GamesList />)
      await screen.findByText(/No games in this period/i)
      expect(container).toMatchSnapshot()
    })

    it('GameCard win outcome snapshot', async () => {
      server.use(
        http.get(`${BASE}/games/week`, () =>
          HttpResponse.json([
            makeGame({
              id: 1,
              player_red_1: 'Lars',
              player_red_2: 'Joan',
              player_blue_1: 'Frank',
              player_blue_2: 'Daniel',
              match_winner: 'red',
              lastUpdated: '2026-05-01 12:00:00.0',
              points_at_stake: 10,
            }),
          ]),
        ),
      )
      renderWithProviders(<GamesList />)
      const card = (await screen.findByText('#1')).closest('article')!
      const time = card.querySelector('time')
      if (time) time.textContent = 'STABLE_TIMESTAMP'
      expect(card).toMatchSnapshot()
    })

    it('GameCard loss outcome snapshot (blue wins)', async () => {
      server.use(
        http.get(`${BASE}/games/week`, () =>
          HttpResponse.json([
            makeGame({
              id: 2,
              player_red_1: 'Lars',
              player_red_2: 'Joan',
              player_blue_1: 'Frank',
              player_blue_2: 'Daniel',
              match_winner: 'blue',
              lastUpdated: '2026-05-01 12:00:00.0',
              points_at_stake: 10,
            }),
          ]),
        ),
      )
      renderWithProviders(<GamesList />)
      const card = (await screen.findByText('#2')).closest('article')!
      const time = card.querySelector('time')
      if (time) time.textContent = 'STABLE_TIMESTAMP'
      expect(card).toMatchSnapshot()
    })

    it('GameCard tie outcome snapshot', async () => {
      server.use(
        http.get(`${BASE}/games/week`, () =>
          HttpResponse.json([
            makeGame({
              id: 3,
              player_red_1: 'Lars',
              player_red_2: 'Joan',
              player_blue_1: 'Frank',
              player_blue_2: 'Daniel',
              match_winner: 'draw',
              lastUpdated: '2026-05-01 12:00:00.0',
              points_at_stake: 10,
            }),
          ]),
        ),
      )
      renderWithProviders(<GamesList />)
      const card = (await screen.findByText('#3')).closest('article')!
      const time = card.querySelector('time')
      if (time) time.textContent = 'STABLE_TIMESTAMP'
      expect(card).toMatchSnapshot()
    })
  })
})
