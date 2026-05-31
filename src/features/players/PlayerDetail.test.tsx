import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { renderWithProviders } from '@/test/render'
import { makeGame, resetFactoryIds } from '@/test/factories'
import { PlayerDetail } from './PlayerDetail'

const BASE = 'http://localhost:5050'

// Recharts uses ResponsiveContainer which depends on ResizeObserver — not
// implemented by jsdom. Polyfill with a no-op so the chart subtree mounts.
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    class ResizeObserverMock {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
    ;(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver =
      ResizeObserverMock
  }
})

beforeEach(() => {
  resetFactoryIds()
})

describe('PlayerDetail — header', () => {
  it('renders the player name, avatar, and back link to /players', async () => {
    server.use(
      http.get(`${BASE}/games/:nameOrPeriod`, () => HttpResponse.json([])),
    )

    renderWithProviders(<PlayerDetail name="Lars" />)

    expect(await screen.findByRole('heading', { name: 'Lars' })).toBeInTheDocument()
    const backLink = screen.getByRole('link', { name: /all players/i })
    expect(backLink).toHaveAttribute('href', '/players')

    // Avatar img comes from the backend photo endpoint, cache-busted.
    const imgs = document.querySelectorAll('img')
    expect(imgs[0].getAttribute('src')).toMatch(
      /\/players\/Lars\/photo\?v=\d+$/,
    )
  })
})

describe('PlayerDetail — stats math', () => {
  it('computes wins/losses/draws/winRate from the games list', async () => {
    server.use(
      http.get(`${BASE}/games/:nameOrPeriod`, () =>
        HttpResponse.json([
          // Lars on red, red wins → win
          makeGame({
            id: 1,
            player_red_1: 'Lars',
            player_red_2: 'X',
            player_blue_1: 'Y',
            player_blue_2: 'Z',
            match_winner: 'red',
            points_at_stake: 10,
          }),
          // Lars on red, blue wins → loss
          makeGame({
            id: 2,
            player_red_1: 'Lars',
            player_red_2: 'X',
            player_blue_1: 'Y',
            player_blue_2: 'Z',
            match_winner: 'blue',
            points_at_stake: 12,
          }),
          // Lars on blue, blue wins → win
          makeGame({
            id: 3,
            player_red_1: 'Y',
            player_red_2: 'Z',
            player_blue_1: 'Lars',
            player_blue_2: 'X',
            match_winner: 'blue',
            points_at_stake: 8,
          }),
          // Lars on red, draw → draw
          makeGame({
            id: 4,
            player_red_1: 'Lars',
            player_red_2: 'X',
            player_blue_1: 'Y',
            player_blue_2: 'Z',
            match_winner: 'draw',
            points_at_stake: 5,
          }),
          // Unknown winner → ignored for win/loss/draw
          makeGame({
            id: 5,
            player_red_1: 'Lars',
            player_red_2: 'X',
            player_blue_1: 'Y',
            player_blue_2: 'Z',
            match_winner: '',
            points_at_stake: 5,
          }),
        ]),
      ),
    )

    renderWithProviders(<PlayerDetail name="Lars" />)

    // Wait for the games to load — chart heading only renders when games.length > 0.
    await screen.findByRole('heading', { name: /points over time/i })

    const gamesCard = screen.getByText('games').closest('div')!
    expect(within(gamesCard).getByText('5')).toBeInTheDocument()
    // 2 wins, 1 loss, 1 draw
    const winCard = screen.getByText('won').closest('div')!
    expect(within(winCard).getByText('2')).toBeInTheDocument()
    const lossCard = screen.getByText('lost').closest('div')!
    expect(within(lossCard).getByText('1')).toBeInTheDocument()
    const drewCard = screen.getByText('drew').closest('div')!
    expect(within(drewCard).getByText('1')).toBeInTheDocument()
    // win rate = 2/5 = 40%
    expect(screen.getByText('40%')).toBeInTheDocument()
  })

  it('shows a 0% win rate and an empty-list message when there are no games', async () => {
    server.use(
      http.get(`${BASE}/games/:nameOrPeriod`, () => HttpResponse.json([])),
    )

    renderWithProviders(<PlayerDetail name="Lars" />)

    expect(await screen.findByText(/no games recorded for lars/i)).toBeInTheDocument()
    expect(screen.getByText('0%')).toBeInTheDocument()
  })
})

describe('PlayerDetail — PointsOverTime chart', () => {
  it('renders the chart section with period tabs when there are games', async () => {
    server.use(
      http.get(`${BASE}/games/:nameOrPeriod`, () =>
        HttpResponse.json([
          makeGame({
            id: 1,
            player_red_1: 'Lars',
            player_red_2: 'X',
            player_blue_1: 'Y',
            player_blue_2: 'Z',
            match_winner: 'red',
            points_at_stake: 10,
            lastUpdated: '2026-04-30 12:00:00.0',
          }),
        ]),
      ),
    )

    renderWithProviders(<PlayerDetail name="Lars" />)

    expect(await screen.findByRole('heading', { name: /points over time/i })).toBeInTheDocument()
    // All five period buttons.
    expect(screen.getByRole('button', { name: 'Last hour' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Today' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'This week' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'This month' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'All time' })).toBeInTheDocument()

    // Default selection is "All time".
    expect(screen.getByRole('button', { name: 'All time' })).toHaveAttribute(
      'aria-current',
      'true',
    )
  })

  it('switches selected tab when clicking a different period', async () => {
    const user = userEvent.setup()
    server.use(
      http.get(`${BASE}/games/:nameOrPeriod`, () =>
        HttpResponse.json([
          makeGame({
            id: 1,
            player_red_1: 'Lars',
            player_red_2: 'X',
            player_blue_1: 'Y',
            player_blue_2: 'Z',
            match_winner: 'red',
            points_at_stake: 10,
            lastUpdated: '2026-04-30 12:00:00.0',
          }),
        ]),
      ),
    )

    renderWithProviders(<PlayerDetail name="Lars" />)

    const hourTab = await screen.findByRole('button', { name: 'Last hour' })
    await user.click(hourTab)

    expect(hourTab).toHaveAttribute('aria-current', 'true')
    expect(screen.getByRole('button', { name: 'All time' })).not.toHaveAttribute(
      'aria-current',
    )

    // Old games (April 30) won't match the "Last hour" cutoff (current date is 2026-05-03)
    // → empty-period message appears.
    expect(screen.getByText(/no games in this period/i)).toBeInTheDocument()
  })

  it('does not render the chart section when the player has no games', async () => {
    server.use(
      http.get(`${BASE}/games/:nameOrPeriod`, () => HttpResponse.json([])),
    )

    renderWithProviders(<PlayerDetail name="Lars" />)

    await screen.findByText(/no games recorded for lars/i)
    expect(screen.queryByRole('heading', { name: /points over time/i })).not.toBeInTheDocument()
  })
})

describe('PlayerDetail — PlayerGameRow', () => {
  it('shows partner and opponents text and the win/loss/tie label', async () => {
    server.use(
      http.get(`${BASE}/games/:nameOrPeriod`, () =>
        HttpResponse.json([
          makeGame({
            id: 11,
            player_red_1: 'Lars',
            player_red_2: 'Joan',
            player_blue_1: 'Frank',
            player_blue_2: 'Daniel',
            match_winner: 'red',
            points_at_stake: 25,
          }),
          makeGame({
            id: 12,
            player_red_1: 'Frank',
            player_red_2: 'Daniel',
            player_blue_1: 'Lars',
            player_blue_2: 'Joan',
            match_winner: 'red',
            points_at_stake: 17,
          }),
          makeGame({
            id: 13,
            player_red_1: 'Lars',
            player_red_2: 'Joan',
            player_blue_1: 'Frank',
            player_blue_2: 'Daniel',
            match_winner: 'draw',
            points_at_stake: 9,
          }),
        ]),
      ),
    )

    renderWithProviders(<PlayerDetail name="Lars" />)

    // Wait for games to load.
    await screen.findByRole('heading', { name: /points over time/i })

    // Lars partners with Joan in all three games → 3 "w/ Joan" spans.
    expect(screen.getAllByText('w/ Joan')).toHaveLength(3)
    expect(screen.getAllByText('vs Frank & Daniel')).toHaveLength(3)

    // One row each: Won, Lost, Tie.
    expect(screen.getByText('Won')).toBeInTheDocument()
    expect(screen.getByText('Lost')).toBeInTheDocument()
    expect(screen.getByText('Tie')).toBeInTheDocument()

    // Points at stake rendered for each row.
    expect(screen.getByText('25 pts')).toBeInTheDocument()
    expect(screen.getByText('17 pts')).toBeInTheDocument()
    expect(screen.getByText('9 pts')).toBeInTheDocument()
  })

  it('classifies a win on the blue side correctly', async () => {
    server.use(
      http.get(`${BASE}/games/:nameOrPeriod`, () =>
        HttpResponse.json([
          makeGame({
            id: 21,
            player_red_1: 'Frank',
            player_red_2: 'Daniel',
            player_blue_1: 'Lars',
            player_blue_2: 'Joan',
            match_winner: 'blue',
            points_at_stake: 13,
          }),
        ]),
      ),
    )

    renderWithProviders(<PlayerDetail name="Lars" />)

    expect(await screen.findByText('Won')).toBeInTheDocument()
    expect(screen.getByText('w/ Joan')).toBeInTheDocument()
    expect(screen.getByText('vs Frank & Daniel')).toBeInTheDocument()
  })

  it('shows "solo" when the partner slot is null', async () => {
    server.use(
      http.get(`${BASE}/games/:nameOrPeriod`, () =>
        HttpResponse.json([
          makeGame({
            id: 31,
            player_red_1: 'Lars',
            player_red_2: null,
            player_blue_1: 'Frank',
            player_blue_2: 'Daniel',
            match_winner: 'red',
            points_at_stake: 8,
          }),
        ]),
      ),
    )

    renderWithProviders(<PlayerDetail name="Lars" />)

    expect(await screen.findByText('solo')).toBeInTheDocument()
  })
})

describe('PlayerDetail — error state', () => {
  it('shows an error message when the games request fails', async () => {
    server.use(
      http.get(`${BASE}/games/:nameOrPeriod`, () =>
        HttpResponse.text('boom', { status: 500 }),
      ),
    )

    renderWithProviders(<PlayerDetail name="Lars" />)
    expect(await screen.findByText(/couldn't load games/i)).toBeInTheDocument()
  })
})

describe('PlayerDetail — snapshot', () => {
  it('matches snapshot for a player with a couple of stable games', async () => {
    server.use(
      http.get(`${BASE}/games/:nameOrPeriod`, () =>
        HttpResponse.json([
          makeGame({
            id: 101,
            player_red_1: 'Lars',
            player_red_2: 'Joan',
            player_blue_1: 'Frank',
            player_blue_2: 'Daniel',
            match_winner: 'red',
            points_at_stake: 20,
            lastUpdated: '2026-04-30 12:00:00.0',
          }),
          makeGame({
            id: 102,
            player_red_1: 'Frank',
            player_red_2: 'Daniel',
            player_blue_1: 'Lars',
            player_blue_2: 'Joan',
            match_winner: 'red',
            points_at_stake: 10,
            lastUpdated: '2026-04-30 13:00:00.0',
          }),
        ]),
      ),
    )

    const { container } = renderWithProviders(<PlayerDetail name="Lars" />)

    // Wait for the games + chart to render before snapshotting.
    await screen.findByRole('heading', { name: 'Lars' })
    await screen.findByRole('heading', { name: /points over time/i })

    // Replace the chart's responsive-container output so snapshots aren't
    // dependent on Recharts internals / measurement.
    const chart = container.querySelector('.chartSection')
    if (chart) {
      const placeholder = document.createElement('div')
      placeholder.setAttribute('data-testid', 'chart-placeholder')
      placeholder.textContent = '[chart]'
      chart.replaceChildren(placeholder)
    }

    expect(container.firstChild).toMatchSnapshot()
  })
})
