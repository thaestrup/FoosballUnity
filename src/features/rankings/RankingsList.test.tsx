import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { renderWithProviders } from '@/test/render'
import { makePlayer, makeRankingItem, resetFactoryIds } from '@/test/factories'
import { RankingsList } from './RankingsList'

const BASE = 'http://localhost:5050'

// recharts uses ResizeObserver internally — jsdom doesn't ship one.
beforeAll(() => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    globalThis.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    } as unknown as typeof ResizeObserver
  }
})

beforeEach(() => {
  resetFactoryIds()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('RankingsList — render', () => {
  it('renders the period tabs with All time selected by default', async () => {
    renderWithProviders(<RankingsList />)

    for (const label of ['Last hour', 'Today', 'This week', 'This month', 'All time']) {
      await screen.findByRole('button', { name: label })
    }
    expect(
      screen.getByRole('button', { name: 'All time' }),
    ).toHaveAttribute('aria-current', 'true')

    // Wait for default handler to settle.
    await screen.findByText('Lars')
  })

  it('shows a loading indicator initially', async () => {
    // Block the request so we can observe the Loading state.
    server.use(
      http.get(
        `${BASE}/pointsPrPlayer/alltime`,
        () => new Promise(() => {}) as unknown as Response,
      ),
    )
    renderWithProviders(<RankingsList />)
    expect(await screen.findByText(/loading rankings/i)).toBeInTheDocument()
  })

  it('shows the empty state when there are no rankings', async () => {
    server.use(
      http.get(`${BASE}/pointsPrPlayer/alltime`, () => HttpResponse.json([])),
    )

    renderWithProviders(<RankingsList />)

    expect(
      await screen.findByText(/No ranked players in this period/i),
    ).toBeInTheDocument()
  })

  it('shows an error state when the rankings fetch fails', async () => {
    server.use(
      http.get(`${BASE}/pointsPrPlayer/alltime`, () =>
        HttpResponse.text('boom', { status: 500 }),
      ),
    )

    renderWithProviders(<RankingsList />)

    expect(
      await screen.findByText(/Failed to load rankings/i),
    ).toBeInTheDocument()
  })
})

describe('RankingsList — sort & display', () => {
  it('renders rows sorted by position asc, then points desc, then name', async () => {
    renderWithProviders(<RankingsList />, {
      preloadedQueries: {
        '["rankings","alltime"]': [
          // Same position to force tiebreaker on points desc.
          makeRankingItem({ name: 'Charlie', position: 1, points: 1500 }),
          makeRankingItem({ name: 'Alpha', position: 1, points: 1700 }),
          makeRankingItem({ name: 'Bravo', position: 1, points: 1600 }),
        ],
      },
    })

    const list = await screen.findByRole('list')
    const items = within(list).getAllByRole('listitem')
    const names = items.map(
      (li) => li.querySelector('.name')?.textContent ?? '',
    )
    expect(names).toEqual(['Alpha', 'Bravo', 'Charlie'])
  })

  it('breaks ties on points by name (alphabetical)', async () => {
    renderWithProviders(<RankingsList />, {
      preloadedQueries: {
        '["rankings","alltime"]': [
          makeRankingItem({ name: 'Zed', position: 1, points: 1500 }),
          makeRankingItem({ name: 'Anna', position: 1, points: 1500 }),
          makeRankingItem({ name: 'Mike', position: 1, points: 1500 }),
        ],
      },
    })

    const list = await screen.findByRole('list')
    const names = within(list)
      .getAllByRole('listitem')
      .map((li) => li.querySelector('.name')?.textContent ?? '')
    expect(names).toEqual(['Anna', 'Mike', 'Zed'])
  })

  it('renders one row per ranking with name, points and games count', async () => {
    renderWithProviders(<RankingsList />, {
      preloadedQueries: {
        '["rankings","alltime"]': [
          makeRankingItem({
            name: 'Lars',
            position: 1,
            points: 1530,
            numberOfGames: 12,
          }),
          makeRankingItem({
            name: 'Joan',
            position: 2,
            points: 1510,
            numberOfGames: 1,
          }),
        ],
      },
    })

    const list = await screen.findByRole('list')
    expect(within(list).getByText('Lars')).toBeInTheDocument()
    expect(within(list).getByText('1530')).toBeInTheDocument()
    expect(within(list).getByText('12 games')).toBeInTheDocument()
    // Singular for 1 game.
    expect(within(list).getByText('1 game')).toBeInTheDocument()
  })

  it('rows link to /player/$name', async () => {
    renderWithProviders(<RankingsList />, {
      preloadedQueries: {
        '["rankings","alltime"]': [
          makeRankingItem({ name: 'Lars', position: 1, points: 1500 }),
        ],
      },
    })

    const link = await screen.findByRole('link', { name: /Lars/ })
    expect(link).toHaveAttribute('href', '/player/Lars')
  })

  it('renders a points-over-time chart when there are ready players', async () => {
    const { container } = renderWithProviders(<RankingsList />, {
      preloadedQueries: {
        '["rankings","alltime"]': [
          makeRankingItem({ name: 'Lars', position: 1, points: 1530 }),
          makeRankingItem({ name: 'Joan', position: 2, points: 1510 }),
        ],
      },
    })

    expect(
      await screen.findByText(/Points over time — 2 ready players/i),
    ).toBeInTheDocument()
    // Recharts wraps everything in .recharts-responsive-container; we don't
    // snapshot the SVG, just assert presence of the wrapper.
    expect(
      container.querySelector('.recharts-responsive-container'),
    ).toBeInTheDocument()
  })

  it('does NOT render the chart when no players are ready', async () => {
    server.use(
      http.get(`${BASE}/players/`, () =>
        HttpResponse.json([
          makePlayer({ name: 'Lars', playerReady: false }),
          makePlayer({ name: 'Joan', playerReady: false }),
        ]),
      ),
    )
    const { container } = renderWithProviders(<RankingsList />, {
      preloadedQueries: {
        '["rankings","alltime"]': [
          makeRankingItem({ name: 'Lars', position: 1, points: 1530 }),
        ],
      },
    })

    expect(
      await screen.findByText(/Select players on the Players page/i),
    ).toBeInTheDocument()
    expect(
      container.querySelector('.recharts-responsive-container'),
    ).not.toBeInTheDocument()
  })
})

describe('RankingsList — period tabs', () => {
  it('switching to "This week" requests /pointsPrPlayer/week', async () => {
    const seen: string[] = []
    server.use(
      http.get(`${BASE}/pointsPrPlayer/:period`, ({ params }) => {
        seen.push(params.period as string)
        return HttpResponse.json([])
      }),
    )

    const user = userEvent.setup()
    renderWithProviders(<RankingsList />)

    // Initial fetch is for alltime.
    await screen.findByText(/No ranked players/i)
    expect(seen).toContain('alltime')

    await user.click(screen.getByRole('button', { name: 'This week' }))

    await screen.findByText(/No ranked players/i)
    expect(seen).toContain('week')
    expect(screen.getByRole('button', { name: 'This week' })).toHaveAttribute(
      'aria-current',
      'true',
    )
  })

  it('hits the right endpoint for each period', async () => {
    const seen: string[] = []
    server.use(
      http.get(`${BASE}/pointsPrPlayer/:period`, ({ params }) => {
        seen.push(params.period as string)
        return HttpResponse.json([])
      }),
    )

    const user = userEvent.setup()
    renderWithProviders(<RankingsList />)

    await screen.findByText(/No ranked players/i)

    for (const label of ['Last hour', 'Today', 'This week', 'This month']) {
      await user.click(screen.getByRole('button', { name: label }))
      await screen.findByText(/No ranked players/i)
    }

    expect(seen).toEqual(
      expect.arrayContaining(['alltime', 'hour', 'day', 'week', 'month']),
    )
  })
})

describe('RankingsList — snapshot', () => {
  it('matches snapshot with three players (chart + list)', async () => {
    const { container } = renderWithProviders(<RankingsList />, {
      preloadedQueries: {
        '["rankings","alltime"]': [
          makeRankingItem({
            name: 'Lars',
            position: 1,
            points: 1530,
            numberOfGames: 12,
          }),
          makeRankingItem({
            name: 'Joan',
            position: 2,
            points: 1510,
            numberOfGames: 9,
          }),
          makeRankingItem({
            name: 'Frank',
            position: 3,
            points: 1490,
            numberOfGames: 7,
          }),
        ],
      },
    })

    await screen.findByText('Lars')
    // Recharts SVG is non-deterministic on size — strip it before snapshotting.
    const chart = container.querySelector('.recharts-responsive-container')
    if (chart) chart.innerHTML = '<!-- recharts SVG omitted -->'
    expect(container.firstChild).toMatchSnapshot()
  })

  it('matches snapshot when empty', async () => {
    server.use(
      http.get(`${BASE}/pointsPrPlayer/alltime`, () => HttpResponse.json([])),
    )
    const { container } = renderWithProviders(<RankingsList />)
    await screen.findByText(/No ranked players/i)
    expect(container.firstChild).toMatchSnapshot()
  })
})
