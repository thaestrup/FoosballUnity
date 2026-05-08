import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { renderWithProviders } from '@/test/render'
import { makeRankingItem, resetFactoryIds } from '@/test/factories'
import { SidebarRankings } from './SidebarRankings'

const BASE = 'http://localhost:5050'

beforeEach(() => {
  resetFactoryIds()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('SidebarRankings — render', () => {
  it('renders the abbreviated period pills with "All" selected by default', async () => {
    renderWithProviders(<SidebarRankings />)

    for (const label of ['Hr', 'Day', 'Wk', 'Mo', 'All']) {
      await screen.findByRole('button', { name: label })
    }
    expect(screen.getByRole('button', { name: 'All' })).toHaveAttribute(
      'aria-current',
      'true',
    )

    await screen.findByText('Lars')
  })

  it('shows a loading state initially', async () => {
    server.use(
      http.get(
        `${BASE}/pointsPrPlayer/alltime`,
        () => new Promise(() => {}) as unknown as Response,
      ),
    )
    renderWithProviders(<SidebarRankings />)
    expect(await screen.findByText(/loading/i)).toBeInTheDocument()
  })

  it('shows the empty state when there are no rankings', async () => {
    server.use(
      http.get(`${BASE}/pointsPrPlayer/alltime`, () => HttpResponse.json([])),
    )
    renderWithProviders(<SidebarRankings />)
    expect(await screen.findByText(/No ranked players yet/i)).toBeInTheDocument()
  })
})

describe('SidebarRankings — sort & limit', () => {
  it('sorts by points desc then name', async () => {
    renderWithProviders(<SidebarRankings />, {
      preloadedQueries: {
        '["rankings","alltime"]': [
          makeRankingItem({ name: 'Charlie', position: 1, points: 1500 }),
          makeRankingItem({ name: 'Alpha', position: 1, points: 1700 }),
          makeRankingItem({ name: 'Bravo', position: 1, points: 1600 }),
          makeRankingItem({ name: 'Anna', position: 1, points: 1500 }), // tiebreak
        ],
      },
    })

    const list = await screen.findByRole('list')
    const names = within(list)
      .getAllByRole('listitem')
      .map((li) => li.querySelector('.name')?.textContent ?? '')
    expect(names).toEqual(['Alpha', 'Bravo', 'Anna', 'Charlie'])
  })

  it('limits the list to 10 entries', async () => {
    const items = Array.from({ length: 25 }, (_, i) =>
      makeRankingItem({
        name: `Player${String(i).padStart(2, '0')}`,
        position: i + 1,
        points: 2000 - i,
      }),
    )

    renderWithProviders(<SidebarRankings />, {
      preloadedQueries: { '["rankings","alltime"]': items },
    })

    const list = await screen.findByRole('list')
    expect(within(list).getAllByRole('listitem')).toHaveLength(10)
  })

  it('applies gold/silver/bronze classes to the first three rows', async () => {
    renderWithProviders(<SidebarRankings />, {
      preloadedQueries: {
        '["rankings","alltime"]': [
          makeRankingItem({ name: 'A', position: 1, points: 1700 }),
          makeRankingItem({ name: 'B', position: 2, points: 1600 }),
          makeRankingItem({ name: 'C', position: 3, points: 1500 }),
          makeRankingItem({ name: 'D', position: 4, points: 1400 }),
        ],
      },
    })

    const list = await screen.findByRole('list')
    const items = within(list).getAllByRole('listitem')

    expect(items[0].querySelector('.medal')).toHaveClass('gold')
    expect(items[1].querySelector('.medal')).toHaveClass('silver')
    expect(items[2].querySelector('.medal')).toHaveClass('bronze')
    // The 4th medal should have none of those classes.
    const fourthMedal = items[3].querySelector('.medal')!
    expect(fourthMedal).not.toHaveClass('gold')
    expect(fourthMedal).not.toHaveClass('silver')
    expect(fourthMedal).not.toHaveClass('bronze')
  })

  it('renders points right-aligned via the .points class', async () => {
    renderWithProviders(<SidebarRankings />, {
      preloadedQueries: {
        '["rankings","alltime"]': [
          makeRankingItem({ name: 'Lars', position: 1, points: 1530 }),
        ],
      },
    })

    const points = await screen.findByText('1530')
    expect(points).toHaveClass('points')
  })

  it('rows link to /player/$name', async () => {
    renderWithProviders(<SidebarRankings />, {
      preloadedQueries: {
        '["rankings","alltime"]': [
          makeRankingItem({ name: 'Lars', position: 1, points: 1500 }),
        ],
      },
    })

    const link = await screen.findByRole('link', { name: /Lars/ })
    expect(link).toHaveAttribute('href', '/player/Lars')
  })
})

describe('SidebarRankings — period switching', () => {
  it('clicking the "Wk" pill requests /pointsPrPlayer/week', async () => {
    const seen: string[] = []
    server.use(
      http.get(`${BASE}/pointsPrPlayer/:period`, ({ params }) => {
        seen.push(params.period as string)
        return HttpResponse.json([])
      }),
    )

    const user = userEvent.setup()
    renderWithProviders(<SidebarRankings />)

    await screen.findByText(/No ranked players yet/i)
    expect(seen).toContain('alltime')

    await user.click(screen.getByRole('button', { name: 'Wk' }))

    await screen.findByText(/No ranked players yet/i)
    expect(seen).toContain('week')
    expect(screen.getByRole('button', { name: 'Wk' })).toHaveAttribute(
      'aria-current',
      'true',
    )
  })

  it('hits the right endpoint for each period pill', async () => {
    const seen: string[] = []
    server.use(
      http.get(`${BASE}/pointsPrPlayer/:period`, ({ params }) => {
        seen.push(params.period as string)
        return HttpResponse.json([])
      }),
    )

    const user = userEvent.setup()
    renderWithProviders(<SidebarRankings />)

    await screen.findByText(/No ranked players yet/i)

    for (const label of ['Hr', 'Day', 'Wk', 'Mo']) {
      await user.click(screen.getByRole('button', { name: label }))
      await screen.findByText(/No ranked players yet/i)
    }

    expect(seen).toEqual(
      expect.arrayContaining(['alltime', 'hour', 'day', 'week', 'month']),
    )
  })
})

describe('SidebarRankings — snapshot', () => {
  it('matches snapshot with mocked rankings', async () => {
    const { container } = renderWithProviders(<SidebarRankings />, {
      preloadedQueries: {
        '["rankings","alltime"]': [
          makeRankingItem({ name: 'Lars', position: 1, points: 1530 }),
          makeRankingItem({ name: 'Joan', position: 2, points: 1510 }),
          makeRankingItem({ name: 'Frank', position: 3, points: 1490 }),
          makeRankingItem({ name: 'Daniel', position: 4, points: 1450 }),
        ],
      },
    })
    await screen.findByText('Lars')
    expect(container.firstChild).toMatchSnapshot()
  })
})
