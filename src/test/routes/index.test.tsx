import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { installAllShims } from '@/test/shims'
import { Dashboard } from '@/features/dashboard/Dashboard'

// HomePage from src/routes/index.tsx is just `<Dashboard />`. Snapshot the
// composed page using pre-seeded query data so the output is deterministic
// (no MSW timing, no isPending flicker).

beforeEach(() => {
  installAllShims()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('route / (HomePage → Dashboard) snapshot', () => {
  it('matches snapshot with pre-seeded queries', async () => {
    const preloadedQueries = {
      [JSON.stringify(['players'])]: [
        { name: 'Lars', playerReady: true, oprettet: '2026-01-01 12:00:00.0', registeredRFIDTag: '' },
        { name: 'Joan', playerReady: true, oprettet: '2026-01-01 12:00:00.0', registeredRFIDTag: '' },
        { name: 'Frank', playerReady: false, oprettet: '2026-01-01 12:00:00.0', registeredRFIDTag: '' },
        { name: 'Daniel', playerReady: false, oprettet: '2026-01-01 12:00:00.0', registeredRFIDTag: '' },
      ],
      [JSON.stringify(['games', 'week'])]: [
        {
          id: 100,
          player_red_1: 'Lars',
          player_red_2: 'Joan',
          player_blue_1: 'Frank',
          player_blue_2: 'Daniel',
          lastUpdated: '2026-05-01 12:00:00.0',
          match_winner: 'red',
          winning_table: 1,
          points_at_stake: 25,
        },
      ],
      [JSON.stringify(['games', 'day'])]: [],
      [JSON.stringify(['rankings', 'alltime'])]: [
        { name: 'Lars', points: 1530, position: 1, numberOfGames: 10 },
        { name: 'Joan', points: 1510, position: 2, numberOfGames: 10 },
        { name: 'Frank', points: 1490, position: 3, numberOfGames: 10 },
      ],
    }

    const { container } = renderWithProviders(<Dashboard />, { preloadedQueries })

    // Wait for at least one stable element so we know the tree has rendered.
    await screen.findByText('Top players')

    expect(container.firstChild).toMatchSnapshot()
  })
})
