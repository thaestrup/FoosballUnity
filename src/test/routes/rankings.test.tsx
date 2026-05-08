import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { renderWithProviders } from '@/test/render'
import { installAllShims } from '@/test/shims'
import { RankingsList } from '@/features/rankings/RankingsList'

const BASE = 'http://localhost:5050'

beforeEach(() => {
  installAllShims()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('route /rankings (RankingsList) snapshot', () => {
  it('matches snapshot with three pinned ranked players (no Recharts internals)', async () => {
    server.use(
      http.get(`${BASE}/pointsPrPlayer/alltime`, () =>
        HttpResponse.json([
          { name: 'Lars', points: 1530, position: 1, numberOfGames: 10 },
          { name: 'Joan', points: 1510, position: 2, numberOfGames: 8 },
          { name: 'Frank', points: 1490, position: 3, numberOfGames: 6 },
        ]),
      ),
    )

    const { container } = renderWithProviders(<RankingsList />)
    await screen.findByText('Lars')

    // Recharts' SVG content is non-deterministic across runs (animation,
    // sizing). Strip the chart subtree before snapshotting and assert on
    // its presence separately.
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
