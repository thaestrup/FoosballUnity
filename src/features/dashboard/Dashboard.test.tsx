import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { renderWithProviders } from '@/test/render'
import {
  makeGame,
  makePlayer,
  makeRankingItem,
  resetFactoryIds,
} from '@/test/factories'
import { Dashboard } from './Dashboard'

const BASE = 'http://localhost:5050'

beforeEach(() => {
  resetFactoryIds()
})

afterEach(() => {
  vi.restoreAllMocks()
})

/**
 * Helper to preload the four queries the Dashboard reads with deterministic
 * data. Returned object is plugged straight into renderWithProviders.
 */
const preload = (opts: {
  players?: ReturnType<typeof makePlayer>[]
  weekGames?: ReturnType<typeof makeGame>[]
  dayGames?: ReturnType<typeof makeGame>[]
  rankings?: ReturnType<typeof makeRankingItem>[]
}) => {
  return {
    '["players"]': opts.players ?? [],
    '["games","week"]': opts.weekGames ?? [],
    '["games","day"]': opts.dayGames ?? [],
    '["rankings","alltime"]': opts.rankings ?? [],
  }
}

describe('Dashboard — stat cards', () => {
  it('renders the three stat cards as links to /players, /games, /rankings', async () => {
    renderWithProviders(<Dashboard />, {
      preloadedQueries: preload({
        players: [
          makePlayer({ name: 'A', playerReady: true }),
          makePlayer({ name: 'B', playerReady: true }),
          makePlayer({ name: 'C', playerReady: false }),
        ],
        weekGames: [makeGame({ id: 1 }), makeGame({ id: 2 })],
        dayGames: [makeGame({ id: 1 })],
        rankings: [
          makeRankingItem({ name: 'A', position: 1, points: 1500 }),
          makeRankingItem({ name: 'B', position: 2, points: 1480 }),
        ],
      }),
    })

    const playersLink = await screen.findByRole('link', {
      name: /of 3 players/i,
    })
    expect(playersLink).toHaveAttribute('href', '/players')
    expect(playersLink).toHaveTextContent('2')

    const gamesLink = screen.getByRole('link', { name: /this week/i })
    expect(gamesLink).toHaveAttribute('href', '/games')
    expect(gamesLink).toHaveTextContent('1')
    expect(gamesLink).toHaveTextContent('2 this week')

    const rankedLink = screen.getByRole('link', { name: /ranked players/i })
    expect(rankedLink).toHaveAttribute('href', '/rankings')
    expect(rankedLink).toHaveTextContent('2')
  })
})

describe('Dashboard — Top players', () => {
  it('renders the podium when there are 3 or more ranked players', async () => {
    renderWithProviders(<Dashboard />, {
      preloadedQueries: preload({
        rankings: [
          makeRankingItem({ name: 'Lars', position: 1, points: 1700 }),
          makeRankingItem({ name: 'Joan', position: 2, points: 1600 }),
          makeRankingItem({ name: 'Frank', position: 3, points: 1500 }),
          makeRankingItem({ name: 'Daniel', position: 4, points: 1400 }),
        ],
      }),
    })

    await screen.findByText('Top players')

    // The podium is a div with three .podiumStep entries — confirm structure.
    const podiumLinks = screen.getAllByRole('link', { name: /Lars|Joan|Frank/ })
    // Exactly three podium links (1st, 2nd, 3rd).
    expect(podiumLinks).toHaveLength(3)

    // Each podium step should link to /player/$name.
    const lars = screen.getByRole('link', { name: /Lars/ })
    const joan = screen.getByRole('link', { name: /Joan/ })
    const frank = screen.getByRole('link', { name: /Frank/ })
    expect(lars).toHaveAttribute('href', '/player/Lars')
    expect(joan).toHaveAttribute('href', '/player/Joan')
    expect(frank).toHaveAttribute('href', '/player/Frank')

    // Daniel (4th) should not appear in the top players section.
    expect(
      screen.queryByRole('link', { name: /Daniel/ }),
    ).not.toBeInTheDocument()
  })

  it('orders the podium silver-gold-bronze in DOM (2nd, 1st, 3rd)', async () => {
    const { container } = renderWithProviders(<Dashboard />, {
      preloadedQueries: preload({
        rankings: [
          makeRankingItem({ name: 'Lars', position: 1, points: 1700 }),
          makeRankingItem({ name: 'Joan', position: 2, points: 1600 }),
          makeRankingItem({ name: 'Frank', position: 3, points: 1500 }),
        ],
      }),
    })

    await screen.findByText('Top players')

    const podium = container.querySelector('.podium')!
    const steps = podium.querySelectorAll('.podiumStep')
    expect(steps).toHaveLength(3)

    // 1st step in DOM is silver (place 2 — Joan), 2nd is gold (Lars), 3rd is bronze (Frank).
    expect(steps[0].textContent).toContain('Joan')
    expect(steps[0].querySelector('.platform')?.textContent).toBe('2')
    expect(steps[1].textContent).toContain('Lars')
    expect(steps[1].querySelector('.platform')?.textContent).toBe('1')
    expect(steps[2].textContent).toContain('Frank')
    expect(steps[2].querySelector('.platform')?.textContent).toBe('3')
  })

  it('falls back to the simple list when there are fewer than 3 ranked players', async () => {
    const { container } = renderWithProviders(<Dashboard />, {
      preloadedQueries: preload({
        rankings: [
          makeRankingItem({ name: 'Lars', position: 1, points: 1700 }),
          makeRankingItem({ name: 'Joan', position: 2, points: 1600 }),
        ],
      }),
    })

    await screen.findByText('Top players')

    // No podium element.
    expect(container.querySelector('.podium')).not.toBeInTheDocument()
    // The fallback ordered list is present with both rows.
    const list = container.querySelector('.topList')!
    expect(list).toBeInTheDocument()
    expect(within(list as HTMLElement).getByText('Lars')).toBeInTheDocument()
    expect(within(list as HTMLElement).getByText('Joan')).toBeInTheDocument()
  })

  it('renders the empty state when there are no ranked players', async () => {
    renderWithProviders(<Dashboard />, {
      preloadedQueries: preload({ rankings: [] }),
    })

    expect(
      await screen.findByText(/No ranked players yet/i),
    ).toBeInTheDocument()
  })

  it('"all rankings →" link points to /rankings', async () => {
    renderWithProviders(<Dashboard />, {
      preloadedQueries: preload({}),
    })

    const link = await screen.findByRole('link', { name: /all rankings/i })
    expect(link).toHaveAttribute('href', '/rankings')
  })
})

describe('Dashboard — Recent games', () => {
  it('renders the empty state when no games this week', async () => {
    renderWithProviders(<Dashboard />, {
      preloadedQueries: preload({ weekGames: [] }),
    })

    expect(await screen.findByText(/No games this week/i)).toBeInTheDocument()
  })

  it('renders up to 4 recent games with id and team text', async () => {
    renderWithProviders(<Dashboard />, {
      preloadedQueries: preload({
        weekGames: [
          makeGame({
            id: 11,
            player_red_1: 'Lars',
            player_red_2: 'Joan',
            player_blue_1: 'Frank',
            player_blue_2: 'Daniel',
            match_winner: 'red',
          }),
          makeGame({
            id: 12,
            player_red_1: 'A',
            player_red_2: 'B',
            player_blue_1: 'C',
            player_blue_2: 'D',
            match_winner: 'blue',
          }),
          makeGame({
            id: 13,
            player_red_1: 'E',
            player_red_2: 'F',
            player_blue_1: 'G',
            player_blue_2: 'H',
            match_winner: 'draw',
          }),
          makeGame({
            id: 14,
            player_red_1: 'I',
            player_red_2: 'J',
            player_blue_1: 'K',
            player_blue_2: 'L',
            match_winner: 'red',
          }),
          // 5th should be sliced off.
          makeGame({ id: 99 }),
        ],
      }),
    })

    expect(await screen.findByText('#11')).toBeInTheDocument()
    expect(screen.getByText('#12')).toBeInTheDocument()
    expect(screen.getByText('#13')).toBeInTheDocument()
    expect(screen.getByText('#14')).toBeInTheDocument()
    expect(screen.queryByText('#99')).not.toBeInTheDocument()

    // Outcome formatting.
    expect(screen.getByText(/Lars & Joan won/)).toBeInTheDocument()
    expect(screen.getByText(/C & D won/)).toBeInTheDocument()
    expect(screen.getByText('Tie')).toBeInTheDocument()
  })

  it('"all games →" link points to /games', async () => {
    renderWithProviders(<Dashboard />, {
      preloadedQueries: preload({}),
    })

    const link = await screen.findByRole('link', { name: /all games/i })
    expect(link).toHaveAttribute('href', '/games')
  })
})

describe('Dashboard — live MSW (no preload)', () => {
  it('renders something useful when reading from MSW defaults', async () => {
    // The default handlers return: 4 players (2 ready), 1 game per period,
    // 3 ranked players. So the podium should appear.
    server.use(
      // Pin the points so order is deterministic for the assertions below.
      http.get(`${BASE}/pointsPrPlayer/alltime`, () =>
        HttpResponse.json([
          { name: 'Lars', position: 1, points: 1530, numberOfGames: 5 },
          { name: 'Joan', position: 2, points: 1510, numberOfGames: 4 },
          { name: 'Frank', position: 3, points: 1490, numberOfGames: 3 },
        ]),
      ),
    )

    renderWithProviders(<Dashboard />)

    expect(await screen.findByText('Top players')).toBeInTheDocument()
    expect(await screen.findByText('Lars')).toBeInTheDocument()
    expect(await screen.findByText('Joan')).toBeInTheDocument()
    expect(await screen.findByText('Frank')).toBeInTheDocument()
  })
})

describe('Dashboard — snapshot', () => {
  it('matches snapshot with podium + recent games', async () => {
    const { container } = renderWithProviders(<Dashboard />, {
      preloadedQueries: preload({
        players: [
          makePlayer({ name: 'A', playerReady: true }),
          makePlayer({ name: 'B', playerReady: false }),
        ],
        weekGames: [
          makeGame({
            id: 1,
            player_red_1: 'Lars',
            player_red_2: 'Joan',
            player_blue_1: 'Frank',
            player_blue_2: 'Daniel',
            match_winner: 'red',
          }),
        ],
        dayGames: [],
        rankings: [
          makeRankingItem({ name: 'Lars', position: 1, points: 1700 }),
          makeRankingItem({ name: 'Joan', position: 2, points: 1600 }),
          makeRankingItem({ name: 'Frank', position: 3, points: 1500 }),
        ],
      }),
    })
    await screen.findByText('Top players')
    expect(container.firstChild).toMatchSnapshot()
  })

  it('matches snapshot with the < 3 ranked fallback list', async () => {
    const { container } = renderWithProviders(<Dashboard />, {
      preloadedQueries: preload({
        players: [],
        weekGames: [],
        dayGames: [],
        rankings: [
          makeRankingItem({ name: 'Lars', position: 1, points: 1700 }),
          makeRankingItem({ name: 'Joan', position: 2, points: 1600 }),
        ],
      }),
    })
    await screen.findByText('Top players')
    expect(container.firstChild).toMatchSnapshot()
  })
})
