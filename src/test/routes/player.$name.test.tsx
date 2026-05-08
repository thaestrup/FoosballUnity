import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { installAllShims } from '@/test/shims'
import { PlayerDetail } from '@/features/players/PlayerDetail'

beforeEach(() => {
  installAllShims()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('route /player/$name (PlayerDetail) snapshot', () => {
  it('matches snapshot for a player with two stable games (no Recharts internals)', async () => {
    const preloadedQueries = {
      [JSON.stringify(['games', 'byPlayer', 'Lars'])]: [
        {
          id: 1,
          player_red_1: 'Lars',
          player_red_2: 'Joan',
          player_blue_1: 'Frank',
          player_blue_2: 'Daniel',
          lastUpdated: '2026-05-01 12:00:00.0',
          match_winner: 'red',
          winning_table: 1,
          points_at_stake: 25,
        },
        {
          id: 2,
          player_red_1: 'Lars',
          player_red_2: 'Joan',
          player_blue_1: 'Frank',
          player_blue_2: 'Daniel',
          lastUpdated: '2026-05-01 13:00:00.0',
          match_winner: 'blue',
          winning_table: 1,
          points_at_stake: 10,
        },
      ],
    }

    const { container } = renderWithProviders(
      <PlayerDetail name="Lars" />,
      { preloadedQueries },
    )

    await screen.findByText('Recent games')

    // Stamp out locale-dependent time text so the snapshot is host-agnostic.
    container.querySelectorAll('time').forEach((t) => {
      t.textContent = 'STABLE_TIMESTAMP'
    })

    // Strip Recharts internals — line plot rendering is not stable.
    expect(container.querySelector('.recharts-wrapper, .recharts-responsive-container'))
      .toBeInTheDocument()
    container
      .querySelectorAll('.recharts-wrapper, .recharts-responsive-container')
      .forEach((el) => {
        el.innerHTML = '<!-- recharts -->'
      })

    expect(container.firstChild).toMatchSnapshot()
  })
})
