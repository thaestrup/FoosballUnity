import { useState } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { renderWithProviders } from '@/test/render'
import { makeRankingItem, resetFactoryIds } from '@/test/factories'
import { ActiveBoards, type BoardStateMap } from './ActiveBoards'
import type { TournamentRound } from './tournament'

const BASE = 'http://localhost:5050'

beforeEach(() => {
  resetFactoryIds()
})

afterEach(() => {
  vi.useRealTimers()
})

// Tiny controlled wrapper so the test can drive ActiveBoards' `states` prop
// the same way the page does (via useStoredJSON).
const Harness = ({
  rounds,
  tableNames,
  allowUneven,
}: {
  rounds: TournamentRound[]
  tableNames: string[]
  allowUneven?: boolean
}) => {
  const [states, setStates] = useState<BoardStateMap>({})
  return (
    <ActiveBoards
      rounds={rounds}
      tableNames={tableNames}
      states={states}
      setStates={setStates}
      allowUneven={allowUneven}
    />
  )
}

const fullRound = (
  red1: string,
  red2: string,
  blue1: string,
  blue2: string,
): TournamentRound => ({
  games: [
    {
      player_red_1: red1,
      player_red_2: red2,
      player_blue_1: blue1,
      player_blue_2: blue2,
    },
  ],
})

describe('ActiveBoards — rendering', () => {
  it('renders multiple boards using each table palette in order', async () => {
    server.use(
      http.get(`${BASE}/pointsPrPlayer/alltime`, () => HttpResponse.json([])),
    )
    const rounds: TournamentRound[] = [
      {
        games: [
          { player_red_1: 'A', player_red_2: 'B', player_blue_1: 'C', player_blue_2: 'D' },
          { player_red_1: 'E', player_red_2: 'F', player_blue_1: 'G', player_blue_2: 'H' },
          { player_red_1: 'I', player_red_2: 'J', player_blue_1: 'K', player_blue_2: 'L' },
          { player_red_1: 'M', player_red_2: 'N', player_blue_1: 'O', player_blue_2: 'P' },
        ],
      },
    ]

    renderWithProviders(<Harness rounds={rounds} tableNames={['T1', 'T2', 'T3', 'T4']} />)

    // Palette names per table: Green/Red, Orange/Blue, Purple/Black, Pink/Lime.
    expect(await screen.findByRole('button', { name: /Green won/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Red won/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Orange won/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Blue won/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Purple won/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Black won/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Pink won/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Lime won/i })).toBeInTheDocument()
  })

  it('renders the per-table image with the right src', async () => {
    server.use(
      http.get(`${BASE}/pointsPrPlayer/alltime`, () => HttpResponse.json([])),
    )
    const rounds: TournamentRound[] = [
      {
        games: [
          { player_red_1: 'A', player_red_2: 'B', player_blue_1: 'C', player_blue_2: 'D' },
          { player_red_1: 'E', player_red_2: 'F', player_blue_1: 'G', player_blue_2: 'H' },
        ],
      },
    ]

    const { container } = renderWithProviders(
      <Harness rounds={rounds} tableNames={['T1', 'T2']} />,
    )
    // Wait for the router to resolve and ActiveBoards to mount.
    await screen.findByRole('button', { name: /Green won/i })
    const imgs = Array.from(container.querySelectorAll('img'))
    const tableImgs = imgs.filter((i) => i.src.includes('fussball-table-nummer-'))
    expect(tableImgs.map((i) => new URL(i.src).pathname)).toEqual([
      '/img/fussball-table-nummer-1.png',
      '/img/fussball-table-nummer-2.png',
    ])
  })

  it('shows the table name in the overlay (single-round form)', async () => {
    server.use(
      http.get(`${BASE}/pointsPrPlayer/alltime`, () => HttpResponse.json([])),
    )
    renderWithProviders(
      <Harness rounds={[fullRound('A', 'B', 'C', 'D')]} tableNames={['Fort Nordjylland']} />,
    )
    expect(await screen.findByText('Fort Nordjylland')).toBeInTheDocument()
  })

  it('prefixes the table label with the round number when there are multiple rounds', async () => {
    server.use(
      http.get(`${BASE}/pointsPrPlayer/alltime`, () => HttpResponse.json([])),
    )
    const rounds: TournamentRound[] = [
      { games: [{ player_red_1: 'A', player_red_2: 'B', player_blue_1: 'C', player_blue_2: 'D' }] },
      { games: [{ player_red_1: 'E', player_red_2: 'F', player_blue_1: 'G', player_blue_2: 'H' }] },
    ]
    renderWithProviders(<Harness rounds={rounds} tableNames={['T1']} />)
    expect(await screen.findByText(/Round 1 · T1/)).toBeInTheDocument()
    expect(screen.getByText(/Round 2 · T1/)).toBeInTheDocument()
  })
})

describe('ActiveBoards — 1v1 boards (both back slots null)', () => {
  it('renders as a 1v1 with no "plays alone" badges on either side', async () => {
    server.use(
      http.get(`${BASE}/pointsPrPlayer/alltime`, () => HttpResponse.json([])),
    )
    const rounds: TournamentRound[] = [
      {
        games: [
          {
            player_red_1: 'Alice',
            player_red_2: null,
            player_blue_1: 'Bob',
            player_blue_2: null,
          },
        ],
      },
    ]
    renderWithProviders(<Harness rounds={rounds} tableNames={['T1']} />)

    // Both player names appear, but no "plays alone" badge, and no
    // Wildcard fallback avatar — the back row is correctly absent.
    expect(await screen.findByText('Alice')).toBeInTheDocument()
    expect(screen.getByText('Bob')).toBeInTheDocument()
    expect(screen.queryByText('plays alone')).not.toBeInTheDocument()
    expect(screen.queryByText(/Wildcard/i)).not.toBeInTheDocument()
    const imgs = Array.from(document.querySelectorAll('img'))
    expect(imgs.some((i) => i.src.includes('/img/Wildcard.jpg'))).toBe(false)
  })

  it('appends " · 1v1" to the table label so the smaller layout is intentional', async () => {
    server.use(
      http.get(`${BASE}/pointsPrPlayer/alltime`, () => HttpResponse.json([])),
    )
    const rounds: TournamentRound[] = [
      {
        games: [
          {
            player_red_1: 'Alice',
            player_red_2: null,
            player_blue_1: 'Bob',
            player_blue_2: null,
          },
        ],
      },
    ]
    renderWithProviders(<Harness rounds={rounds} tableNames={['Fort']} />)

    expect(await screen.findByText('Fort · 1v1')).toBeInTheDocument()
  })

  it('does NOT mark a 2v2 board as 1v1', async () => {
    server.use(
      http.get(`${BASE}/pointsPrPlayer/alltime`, () => HttpResponse.json([])),
    )
    renderWithProviders(
      <Harness rounds={[fullRound('A', 'B', 'C', 'D')]} tableNames={['Fort']} />,
    )

    expect(await screen.findByText('Fort')).toBeInTheDocument()
    expect(screen.queryByText(/· 1v1/)).not.toBeInTheDocument()
  })
})

describe('ActiveBoards — 2v1 filtering by allowUneven', () => {
  const twoBoardsRound: TournamentRound[] = [
    {
      games: [
        // 2v2 board — always visible.
        { player_red_1: 'A', player_red_2: 'B', player_blue_1: 'C', player_blue_2: 'D' },
        // 2v1 board (blue side short) — gated on allowUneven.
        { player_red_1: 'E', player_red_2: 'F', player_blue_1: 'G', player_blue_2: null },
      ],
    },
  ]

  it('hides 2v1 boards when allowUneven is false (the default product behaviour)', async () => {
    server.use(
      http.get(`${BASE}/pointsPrPlayer/alltime`, () => HttpResponse.json([])),
    )
    renderWithProviders(
      <Harness rounds={twoBoardsRound} tableNames={['T1', 'T2']} allowUneven={false} />,
    )

    // First (2v2) board visible.
    expect(await screen.findByText('A')).toBeInTheDocument()
    // Second (2v1) board hidden — none of its players render.
    expect(screen.queryByText('E')).not.toBeInTheDocument()
    expect(screen.queryByText('G')).not.toBeInTheDocument()
    expect(screen.queryByText('plays alone')).not.toBeInTheDocument()
  })

  it('shows 2v1 boards (with "plays alone") when allowUneven is true', async () => {
    server.use(
      http.get(`${BASE}/pointsPrPlayer/alltime`, () => HttpResponse.json([])),
    )
    renderWithProviders(
      <Harness rounds={twoBoardsRound} tableNames={['T1', 'T2']} allowUneven={true} />,
    )

    expect(await screen.findByText('E')).toBeInTheDocument()
    expect(screen.getByText('G')).toBeInTheDocument()
    expect(screen.getByText('plays alone')).toBeInTheDocument()
  })
})

describe('ActiveBoards — solo / partial / empty teams', () => {
  it('shows "plays alone" when one slot is null but the side has at least one player', async () => {
    server.use(
      http.get(`${BASE}/pointsPrPlayer/alltime`, () => HttpResponse.json([])),
    )
    const rounds: TournamentRound[] = [
      {
        games: [
          { player_red_1: 'Solo', player_red_2: null, player_blue_1: 'C', player_blue_2: 'D' },
        ],
      },
    ]
    renderWithProviders(<Harness rounds={rounds} tableNames={['T1']} />)

    expect(await screen.findByText('plays alone')).toBeInTheDocument()
    // Still reportable.
    expect(screen.getByRole('button', { name: /Green won/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Red won/i })).toBeInTheDocument()
  })

  it('shows "One side has no players" and hides the report buttons when a side is empty', async () => {
    server.use(
      http.get(`${BASE}/pointsPrPlayer/alltime`, () => HttpResponse.json([])),
    )
    const rounds: TournamentRound[] = [
      {
        games: [
          { player_red_1: null, player_red_2: null, player_blue_1: 'C', player_blue_2: 'D' },
        ],
      },
    ]
    renderWithProviders(<Harness rounds={rounds} tableNames={['T1']} />)

    expect(await screen.findByText(/One side has no players/i)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /won/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Tie$/i })).not.toBeInTheDocument()
  })
})

describe('ActiveBoards — stakes (calculateStakes via rendered button text)', () => {
  it('shows equal stakes (+25 / +25) when both teams have the same total ELO', async () => {
    server.use(
      http.get(`${BASE}/pointsPrPlayer/alltime`, () =>
        HttpResponse.json([
          makeRankingItem({ name: 'A', points: 1500, position: 1 }),
          makeRankingItem({ name: 'B', points: 1500, position: 2 }),
          makeRankingItem({ name: 'C', points: 1500, position: 3 }),
          makeRankingItem({ name: 'D', points: 1500, position: 4 }),
        ]),
      ),
    )

    renderWithProviders(<Harness rounds={[fullRound('A', 'B', 'C', 'D')]} tableNames={['T1']} />)

    const greenBtn = await screen.findByRole('button', { name: /Green won.*25 pts/i })
    const redBtn = screen.getByRole('button', { name: /Red won.*25 pts/i })
    expect(greenBtn).toBeInTheDocument()
    expect(redBtn).toBeInTheDocument()
  })

  it('rewards the underdog more than the favored team', async () => {
    server.use(
      http.get(`${BASE}/pointsPrPlayer/alltime`, () =>
        HttpResponse.json([
          // Red total = 2900 (the underdog), Blue total = 3100 (favored)
          makeRankingItem({ name: 'UnderA', points: 1450, position: 4 }),
          makeRankingItem({ name: 'UnderB', points: 1450, position: 5 }),
          makeRankingItem({ name: 'OverA', points: 1550, position: 1 }),
          makeRankingItem({ name: 'OverB', points: 1550, position: 2 }),
        ]),
      ),
    )

    renderWithProviders(
      <Harness rounds={[fullRound('UnderA', 'UnderB', 'OverA', 'OverB')]} tableNames={['T1']} />,
    )

    // Math: redDiff=200, redWe ≈ 0.387, blueWe ≈ 0.613.
    //   redWin = floor(50 * 0.613) = 30
    //   blueWin = floor(50 * 0.387) = 19
    //   sum=49 < 50 → blueWin bumped to 50-30 = 20
    const greenBtn = await screen.findByRole('button', { name: /Green won.*30 pts/i })
    const blueBtn = screen.getByRole('button', { name: /Red won.*20 pts/i })
    expect(greenBtn).toBeInTheDocument()
    expect(blueBtn).toBeInTheDocument()
  })

  it('balances a wide gap so the heavily-favored side still gets at least 1 pt', async () => {
    server.use(
      http.get(`${BASE}/pointsPrPlayer/alltime`, () =>
        HttpResponse.json([
          // Red total 2000, Blue total 4000 → 2000-pt gap.
          makeRankingItem({ name: 'WeakA', points: 1000, position: 8 }),
          makeRankingItem({ name: 'WeakB', points: 1000, position: 9 }),
          makeRankingItem({ name: 'StrongA', points: 2000, position: 1 }),
          makeRankingItem({ name: 'StrongB', points: 2000, position: 2 }),
        ]),
      ),
    )

    renderWithProviders(
      <Harness
        rounds={[fullRound('WeakA', 'WeakB', 'StrongA', 'StrongB')]}
        tableNames={['T1']}
      />,
    )

    // Math: redDiff=2000, redWe ≈ 0.0099, blueWe ≈ 0.9901.
    //   redWin = floor(50 * 0.9901) = 49
    //   blueWin = floor(50 * 0.0099) = 0
    //   sum=49 < 50 → blueWin bumped to 50-49 = 1
    const greenBtn = await screen.findByRole('button', { name: /Green won.*49 pts/i })
    const redBtn = screen.getByRole('button', { name: /Red won.*1 pts/i })
    expect(greenBtn).toBeInTheDocument()
    expect(redBtn).toBeInTheDocument()
  })

  it('falls back to 1500 per unranked player when no rankings exist (even split → 25/25)', async () => {
    server.use(
      http.get(`${BASE}/pointsPrPlayer/alltime`, () => HttpResponse.json([])),
    )

    renderWithProviders(
      <Harness rounds={[fullRound('Nobody1', 'Nobody2', 'Nobody3', 'Nobody4')]} tableNames={['T1']} />,
    )

    expect(
      await screen.findByRole('button', { name: /Green won.*25 pts/i }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Red won.*25 pts/i }),
    ).toBeInTheDocument()
    expect(screen.getAllByText('unranked').length).toBe(4)
  })
})

describe('ActiveBoards — reporting', () => {
  it('POSTs the right payload when a winner is clicked, and shows "Reported as #N"', async () => {
    const user = userEvent.setup()
    let captured: unknown = null
    server.use(
      http.get(`${BASE}/pointsPrPlayer/alltime`, () =>
        HttpResponse.json([
          makeRankingItem({ name: 'A', points: 1500, position: 1 }),
          makeRankingItem({ name: 'B', points: 1500, position: 2 }),
          makeRankingItem({ name: 'C', points: 1500, position: 3 }),
          makeRankingItem({ name: 'D', points: 1500, position: 4 }),
        ]),
      ),
      http.post(`${BASE}/games/`, async ({ request }) => {
        captured = await request.json()
        return HttpResponse.json({ newGameIDs: ['77'] })
      }),
    )

    renderWithProviders(<Harness rounds={[fullRound('A', 'B', 'C', 'D')]} tableNames={['T1']} />)

    const greenBtn = await screen.findByRole('button', { name: /Green won/i })
    await user.click(greenBtn)

    await waitFor(() => expect(captured).not.toBeNull())

    expect(Array.isArray(captured)).toBe(true)
    const arr = captured as Array<Record<string, unknown>>
    expect(arr).toHaveLength(1)
    expect(arr[0]).toMatchObject({
      player_red_1: 'A',
      player_red_2: 'B',
      player_blue_1: 'C',
      player_blue_2: 'D',
      match_winner: 'red',
      points_at_stake: 25,
      winning_table: 1,
    })
    expect(typeof arr[0].lastUpdated).toBe('string')

    expect(await screen.findByText(/Reported as #77/)).toBeInTheDocument()
  })

  it('sends points: 0 and match_winner: "draw" when Tie is clicked', async () => {
    const user = userEvent.setup()
    let captured: unknown = null
    server.use(
      http.get(`${BASE}/pointsPrPlayer/alltime`, () =>
        HttpResponse.json([
          makeRankingItem({ name: 'A', points: 1450, position: 4 }),
          makeRankingItem({ name: 'B', points: 1450, position: 5 }),
          makeRankingItem({ name: 'C', points: 1550, position: 1 }),
          makeRankingItem({ name: 'D', points: 1550, position: 2 }),
        ]),
      ),
      http.post(`${BASE}/games/`, async ({ request }) => {
        captured = await request.json()
        return HttpResponse.json({ newGameIDs: ['1'] })
      }),
    )

    renderWithProviders(<Harness rounds={[fullRound('A', 'B', 'C', 'D')]} tableNames={['T1']} />)

    const tieBtn = await screen.findByRole('button', { name: /^Tie/i })
    await user.click(tieBtn)

    await waitFor(() => expect(captured).not.toBeNull())

    const arr = captured as Array<Record<string, unknown>>
    expect(arr[0]).toMatchObject({
      match_winner: 'draw',
      points_at_stake: 0,
    })
  })

  it('still POSTs and reports successfully on a solo board', async () => {
    const user = userEvent.setup()
    let captured: unknown = null
    server.use(
      http.get(`${BASE}/pointsPrPlayer/alltime`, () => HttpResponse.json([])),
      http.post(`${BASE}/games/`, async ({ request }) => {
        captured = await request.json()
        return HttpResponse.json({ newGameIDs: ['9'] })
      }),
    )

    const rounds: TournamentRound[] = [
      {
        games: [
          { player_red_1: 'Solo', player_red_2: null, player_blue_1: 'C', player_blue_2: 'D' },
        ],
      },
    ]
    renderWithProviders(<Harness rounds={rounds} tableNames={['T1']} />)

    const blueBtn = await screen.findByRole('button', { name: /Red won/i })
    await user.click(blueBtn)

    await waitFor(() => expect(captured).not.toBeNull())
    const arr = captured as Array<Record<string, unknown>>
    expect(arr[0]).toMatchObject({
      player_red_1: 'Solo',
      player_red_2: null,
      player_blue_1: 'C',
      player_blue_2: 'D',
      match_winner: 'blue',
    })

    expect(await screen.findByText(/Reported as #9/)).toBeInTheDocument()
  })

  it('does not double-report once a board is in the reported state', async () => {
    const user = userEvent.setup()
    let postCount = 0
    server.use(
      http.get(`${BASE}/pointsPrPlayer/alltime`, () => HttpResponse.json([])),
      http.post(`${BASE}/games/`, () => {
        postCount += 1
        return HttpResponse.json({ newGameIDs: [String(postCount)] })
      }),
    )

    renderWithProviders(<Harness rounds={[fullRound('A', 'B', 'C', 'D')]} tableNames={['T1']} />)
    const greenBtn = await screen.findByRole('button', { name: /Green won/i })
    await user.click(greenBtn)

    await waitFor(() => expect(screen.getByText(/Reported as #1/)).toBeInTheDocument())
    // After reporting, the action buttons disappear.
    expect(screen.queryByRole('button', { name: /Green won/i })).not.toBeInTheDocument()
    expect(postCount).toBe(1)
  })
})

describe('ActiveBoards — snapshots', () => {
  it('matches snapshot for a fully-staffed single board', async () => {
    server.use(
      http.get(`${BASE}/pointsPrPlayer/alltime`, () => HttpResponse.json([])),
    )
    const { container } = renderWithProviders(
      <Harness rounds={[fullRound('A', 'B', 'C', 'D')]} tableNames={['T1']} />,
    )
    // Wait for the rankings query to settle so the player rank text is final.
    await screen.findByRole('button', { name: /Green won/i })
    expect(container.firstChild).toMatchSnapshot()
  })

  it('matches snapshot for a board with one solo side', async () => {
    server.use(
      http.get(`${BASE}/pointsPrPlayer/alltime`, () => HttpResponse.json([])),
    )
    const rounds: TournamentRound[] = [
      {
        games: [
          { player_red_1: 'Solo', player_red_2: null, player_blue_1: 'C', player_blue_2: 'D' },
        ],
      },
    ]
    const { container } = renderWithProviders(
      <Harness rounds={rounds} tableNames={['T1']} />,
    )
    await screen.findByText('plays alone')
    expect(container.firstChild).toMatchSnapshot()
  })

  it('matches snapshot for a board with a fully-empty side', async () => {
    server.use(
      http.get(`${BASE}/pointsPrPlayer/alltime`, () => HttpResponse.json([])),
    )
    const rounds: TournamentRound[] = [
      {
        games: [
          { player_red_1: null, player_red_2: null, player_blue_1: 'C', player_blue_2: 'D' },
        ],
      },
    ]
    const { container } = renderWithProviders(
      <Harness rounds={rounds} tableNames={['T1']} />,
    )
    await screen.findByText(/One side has no players/i)
    expect(container.firstChild).toMatchSnapshot()
  })
})

// Verifies the test suite imports run with no console noise that would
// indicate a broken setup. Only here so a future refactor that breaks the
// rankings query loudly fails.
describe('ActiveBoards — sanity', () => {
  it('renders without crashing when rankings query returns empty', async () => {
    server.use(
      http.get(`${BASE}/pointsPrPlayer/alltime`, () => HttpResponse.json([])),
    )
    renderWithProviders(
      <Harness rounds={[fullRound('A', 'B', 'C', 'D')]} tableNames={['T1']} />,
    )
    await screen.findByRole('button', { name: /Green won/i })
    expect(within(document.body).getByText('A')).toBeInTheDocument()
  })
})
