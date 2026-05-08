import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { renderWithProviders } from '@/test/render'
import { installAllShims } from '@/test/shims'
import { PlayersList } from '@/features/players/PlayersList'

const BASE = 'http://localhost:5050'

beforeEach(() => {
  installAllShims()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('route /players (PlayersList) snapshot', () => {
  it('matches snapshot with default mocked players and pinned lastPlayed', async () => {
    // Pin lastPlayed to {} so the recency sort is deterministic
    // (alphabetical fallback only).
    server.use(
      http.get(`${BASE}/statisticsPlayersLastPlayed/`, () => HttpResponse.json({})),
    )

    const { container } = renderWithProviders(<PlayersList />)
    await screen.findByText('Lars')
    await screen.findByText('Daniel')

    expect(container.firstChild).toMatchSnapshot()
  })
})
