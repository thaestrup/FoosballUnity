import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '@/test/server'
import { renderWithProviders } from '@/test/render'
import { makePlayer, resetFactoryIds } from '@/test/factories'
import { ReportGameForm } from './ReportGameForm'

const BASE = 'http://localhost:5050'

beforeEach(() => {
  resetFactoryIds()
  // jsdom doesn't implement window.scrollTo; the router calls it on
  // transitions. Stub so it doesn't pollute test output.
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  // Standardise on four ready players so the form's defaults are valid
  // (distinct red1/red2/blue1/blue2). Individual tests can override.
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
})

afterEach(() => {
  vi.restoreAllMocks()
})

const waitForPlayersToLoad = async () => {
  // The four selects need their <option>s populated before we can pick.
  // Each select includes the placeholder + every player as an <option>; with
  // four selects we expect at least four matches for any given name.
  await screen.findAllByRole('option', { name: 'Lars' })
}

describe('ReportGameForm', () => {
  describe('rendering', () => {
    it('renders the four player selects, the winner radios and the number inputs', async () => {
      renderWithProviders(<ReportGameForm />)
      await waitForPlayersToLoad()

      expect(screen.getAllByRole('combobox')).toHaveLength(4)
      expect(screen.getByRole('radio', { name: 'Red' })).toBeInTheDocument()
      expect(screen.getByRole('radio', { name: 'Blue' })).toBeInTheDocument()
      expect(screen.getByRole('radio', { name: 'Tie' })).toBeInTheDocument()
      expect(screen.getByRole('spinbutton', { name: /Points/i })).toBeInTheDocument()
      expect(screen.getByRole('spinbutton', { name: /Table/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: /^Report game$/ })).toBeInTheDocument()
    })

    it('defaults the winner to "red"', async () => {
      renderWithProviders(<ReportGameForm />)
      await waitForPlayersToLoad()

      expect(screen.getByRole('radio', { name: 'Red' })).toBeChecked()
      expect(screen.getByRole('radio', { name: 'Blue' })).not.toBeChecked()
      expect(screen.getByRole('radio', { name: 'Tie' })).not.toBeChecked()
    })

    it('seeds defaults from the first four playerReady players (verified by submit payload)', async () => {
      // RHF's register() leaves <select>.value reading as '' until the user
      // interacts (it sets defaults via ref, not via the `selected` attribute).
      // Verify defaults indirectly: submitting without changing anything
      // should send the four ready players to the backend.
      const captured: unknown[] = []
      server.use(
        http.post(`${BASE}/games/`, async ({ request }) => {
          captured.push(await request.json())
          return HttpResponse.json({ newGameIDs: ['1'] })
        }),
      )

      const onReported = vi.fn()
      const user = userEvent.setup()
      renderWithProviders(<ReportGameForm onReported={onReported} />)
      await waitForPlayersToLoad()

      await user.click(screen.getByRole('button', { name: /^Report game$/ }))

      await vi.waitFor(() => expect(onReported).toHaveBeenCalledOnce())
      const body = captured[0] as Array<Record<string, unknown>>
      expect(body[0]).toMatchObject({
        player_red_1: 'Lars',
        player_red_2: 'Joan',
        player_blue_1: 'Frank',
        player_blue_2: 'Daniel',
      })
    })

    it('seeds defaults from the prefill prop when provided (verified by submit payload)', async () => {
      const captured: unknown[] = []
      server.use(
        http.post(`${BASE}/games/`, async ({ request }) => {
          captured.push(await request.json())
          return HttpResponse.json({ newGameIDs: ['1'] })
        }),
      )

      const onReported = vi.fn()
      const user = userEvent.setup()
      renderWithProviders(
        <ReportGameForm
          prefill={{ red1: 'Frank', red2: 'Daniel', blue1: 'Lars', blue2: 'Joan' }}
          onReported={onReported}
        />,
      )
      await waitForPlayersToLoad()

      await user.click(screen.getByRole('button', { name: /^Report game$/ }))

      await vi.waitFor(() => expect(onReported).toHaveBeenCalledOnce())
      const body = captured[0] as Array<Record<string, unknown>>
      expect(body[0]).toMatchObject({
        player_red_1: 'Frank',
        player_red_2: 'Daniel',
        player_blue_1: 'Lars',
        player_blue_2: 'Joan',
      })
    })

    it('omits the cancel button when no onCancel handler is given', async () => {
      renderWithProviders(<ReportGameForm />)
      await waitForPlayersToLoad()

      expect(screen.queryByRole('button', { name: /^Cancel$/ })).toBeNull()
    })
  })

  describe('validation', () => {
    it('shows a "different players" error when two slots match', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ReportGameForm />)
      await waitForPlayersToLoad()

      const selects = screen.getAllByRole('combobox')
      // Make blue2 collide with red1.
      await user.selectOptions(selects[3], 'Lars')
      await user.click(screen.getByRole('button', { name: /^Report game$/ }))

      expect(
        await screen.findByText(/All four players must be different/i),
      ).toBeInTheDocument()
    })

    it('rejects an out-of-range points value (>99)', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ReportGameForm />)
      await waitForPlayersToLoad()

      const points = screen.getByRole('spinbutton', { name: /Points/i })
      await user.clear(points)
      await user.type(points, '100')
      await user.click(screen.getByRole('button', { name: /^Report game$/ }))

      // Zod `max(99)` produces a message like "Number must be less than or equal to 99".
      expect(await screen.findByRole('alert')).toBeInTheDocument()
    })

    it('rejects a too-small table value (<1)', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ReportGameForm />)
      await waitForPlayersToLoad()

      const table = screen.getByRole('spinbutton', { name: /Table/i })
      await user.clear(table)
      await user.type(table, '0')
      await user.click(screen.getByRole('button', { name: /^Report game$/ }))

      expect(await screen.findByRole('alert')).toBeInTheDocument()
    })

    it('shows a required error if a select is left empty', async () => {
      const user = userEvent.setup()
      renderWithProviders(<ReportGameForm />)
      await waitForPlayersToLoad()

      const selects = screen.getAllByRole('combobox')
      // Pick the empty placeholder option.
      await user.selectOptions(selects[0], '')
      await user.click(screen.getByRole('button', { name: /^Report game$/ }))

      expect(await screen.findByText(/red1: Required/i)).toBeInTheDocument()
    })
  })

  describe('submission', () => {
    it('POSTs /games/ with the expected payload shape and reports the new id', async () => {
      const captured: unknown[] = []
      server.use(
        http.post(`${BASE}/games/`, async ({ request }) => {
          captured.push(await request.json())
          return HttpResponse.json({ newGameIDs: ['77'] })
        }),
      )

      const onReported = vi.fn()
      const user = userEvent.setup()
      renderWithProviders(<ReportGameForm onReported={onReported} />)
      await waitForPlayersToLoad()

      // Switch winner to blue.
      await user.click(screen.getByRole('radio', { name: 'Blue' }))

      // Bump points to 7 and table to 2.
      const points = screen.getByRole('spinbutton', { name: /Points/i })
      await user.clear(points)
      await user.type(points, '7')
      const table = screen.getByRole('spinbutton', { name: /Table/i })
      await user.clear(table)
      await user.type(table, '2')

      await user.click(screen.getByRole('button', { name: /^Report game$/ }))

      await vi.waitFor(() => expect(onReported).toHaveBeenCalledOnce())
      expect(onReported).toHaveBeenCalledWith(77)

      expect(captured).toHaveLength(1)
      const body = captured[0] as Array<Record<string, unknown>>
      expect(body[0]).toMatchObject({
        player_red_1: 'Lars',
        player_red_2: 'Joan',
        player_blue_1: 'Frank',
        player_blue_2: 'Daniel',
        match_winner: 'blue',
        points_at_stake: 7,
        winning_table: 2,
      })
      expect(typeof body[0].lastUpdated).toBe('string')
    })

    it('reports undefined id when the backend response has no newGameIDs', async () => {
      server.use(
        http.post(`${BASE}/games/`, () => HttpResponse.json({ newGameIDs: [] })),
      )

      const onReported = vi.fn()
      const user = userEvent.setup()
      renderWithProviders(<ReportGameForm onReported={onReported} />)
      await waitForPlayersToLoad()

      await user.click(screen.getByRole('button', { name: /^Report game$/ }))

      await vi.waitFor(() => expect(onReported).toHaveBeenCalledOnce())
      expect(onReported).toHaveBeenCalledWith(undefined)
    })

    it('errors when the backend returns a non-conforming response (e.g. plain text)', async () => {
      // Today the api<T>() helper happily returns the raw text and
      // useReportGame casts it to { newGameIDs }. Without runtime parsing,
      // res.newGameIDs?.[0] is silently undefined and the form claims
      // success. With Zod parsing on the response, this should error
      // visibly so the user knows something is wrong.
      server.use(
        http.post(`${BASE}/games/`, () =>
          HttpResponse.text('insertGame: someName, result: 88'),
        ),
      )

      const onReported = vi.fn()
      const user = userEvent.setup()
      renderWithProviders(<ReportGameForm onReported={onReported} />)
      await waitForPlayersToLoad()

      await user.click(screen.getByRole('button', { name: /^Report game$/ }))

      // The form should NOT report success; instead an error alert renders.
      await screen.findByRole('alert')
      expect(onReported).not.toHaveBeenCalled()
    })

    it('shows the mutation error message when the backend fails', async () => {
      server.use(
        http.post(`${BASE}/games/`, () =>
          new HttpResponse('boom', { status: 500 }),
        ),
      )

      const user = userEvent.setup()
      renderWithProviders(<ReportGameForm />)
      await waitForPlayersToLoad()

      await user.click(screen.getByRole('button', { name: /^Report game$/ }))

      // ApiError message includes "POST /games/ → 500".
      expect(await screen.findByText(/500/)).toBeInTheDocument()
    })
  })

  describe('regression: cache invalidation must not wipe user input', () => {
    it('keeps a typed Points value when the players query refetches with different data', async () => {
      const user = userEvent.setup()
      const { queryClient } = renderWithProviders(<ReportGameForm />)
      await waitForPlayersToLoad()

      // User types a custom point value but has not submitted yet.
      const points = screen.getByRole('spinbutton', { name: /Points/i })
      await user.clear(points)
      await user.type(points, '42')
      expect(points).toHaveValue(42)

      // Simulate the kind of change a real cache invalidation produces:
      // someone toggled Daniel off-ready, so the next /players response has
      // him with playerReady: false AND a brand-new player Eve appears. The
      // `ready` filter swaps from [Lars,Joan,Frank,Daniel] to
      // [Lars,Joan,Frank,Eve]. The defaults memo's blue2 slot changes from
      // 'Daniel' to 'Eve' — RHF's `values` prop sees different content and
      // resets the entire form, wiping the typed Points value.
      server.use(
        http.get(`${BASE}/players/`, () =>
          HttpResponse.json([
            makePlayer({ name: 'Lars', playerReady: true }),
            makePlayer({ name: 'Joan', playerReady: true }),
            makePlayer({ name: 'Frank', playerReady: true }),
            makePlayer({ name: 'Daniel', playerReady: false }),
            makePlayer({ name: 'Eve', playerReady: true }),
          ]),
        ),
      )
      await queryClient.invalidateQueries({ queryKey: ['players'] })

      // Eve appears in the player option list once the refetch completes and
      // the form re-renders against the new data.
      await screen.findAllByRole('option', { name: 'Eve' })

      // The form must still hold the user's typed value.
      expect(points).toHaveValue(42)
    })
  })

  describe('cancel', () => {
    it('invokes onCancel when the cancel button is clicked', async () => {
      const onCancel = vi.fn()
      const user = userEvent.setup()
      renderWithProviders(<ReportGameForm onCancel={onCancel} />)
      await waitForPlayersToLoad()

      await user.click(screen.getByRole('button', { name: /^Cancel$/ }))
      expect(onCancel).toHaveBeenCalledOnce()
    })
  })

  describe('snapshots', () => {
    it('matches snapshot in its default open state', async () => {
      const { container } = renderWithProviders(<ReportGameForm onCancel={() => {}} />)
      await waitForPlayersToLoad()
      expect(container).toMatchSnapshot()
    })

    it('matches snapshot when prefilled', async () => {
      const { container } = renderWithProviders(
        <ReportGameForm
          prefill={{ red1: 'Frank', red2: 'Daniel', blue1: 'Lars', blue2: 'Joan' }}
          onCancel={() => {}}
        />,
      )
      await waitForPlayersToLoad()
      expect(container).toMatchSnapshot()
    })
  })
})
