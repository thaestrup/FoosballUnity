import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { renderWithProviders } from '@/test/render'
import { installAllShims } from '@/test/shims'
import { GamesList } from '@/features/games/GamesList'

const BASE = 'http://localhost:5050'

beforeEach(() => {
  installAllShims()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('route /games (GamesList) snapshot', () => {
  it('matches snapshot with prefill=null and one stable game', async () => {
    server.use(
      http.get(`${BASE}/games/week`, () =>
        HttpResponse.json([
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
        ]),
      ),
    )

    const { container } = renderWithProviders(<GamesList prefill={null} />)

    await screen.findByText('#100')

    // Stomp the locale-dependent timestamp so the snapshot is host-agnostic.
    const time = container.querySelector('time')
    if (time) time.textContent = 'STABLE_TIMESTAMP'

    expect(container.firstChild).toMatchSnapshot()
  })
})
