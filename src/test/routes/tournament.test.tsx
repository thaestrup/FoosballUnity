import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import { renderWithProviders } from '@/test/render'
import { installAllShims } from '@/test/shims'
import { Tournament } from '@/features/tournament/Tournament'

vi.mock('canvas-confetti', () => ({ default: vi.fn() }))

beforeEach(() => {
  installAllShims()
  // Tournament reads/writes sessionStorage via useStoredJSON. Wipe it so
  // earlier tests in the same module don't leak persisted rounds/states.
  window.sessionStorage.clear()
})

afterEach(() => {
  vi.restoreAllMocks()
  window.sessionStorage.clear()
})

describe('route /tournament (Tournament) snapshot', () => {
  it('matches snapshot in its initial "no rounds yet" state with pre-seeded queries', async () => {
    const preloadedQueries = {
      [JSON.stringify(['players'])]: [
        { name: 'Lars', playerReady: true, oprettet: '2026-01-01 12:00:00.0', registeredRFIDTag: '' },
        { name: 'Joan', playerReady: true, oprettet: '2026-01-01 12:00:00.0', registeredRFIDTag: '' },
        { name: 'Frank', playerReady: true, oprettet: '2026-01-01 12:00:00.0', registeredRFIDTag: '' },
        { name: 'Daniel', playerReady: true, oprettet: '2026-01-01 12:00:00.0', registeredRFIDTag: '' },
      ],
      [JSON.stringify(['configuration'])]: [
        { name: 'numberOfTables', value: '2' },
        { name: 'nameTable1', value: 'Fort Nordjylland' },
        { name: 'nameTable2', value: 'John og Nikolaj Stadion' },
      ],
      [JSON.stringify(['timer'])]: { id: 1, lastRequestedTimerStart: '2026-05-01 12:00:00.0' },
      [JSON.stringify(['rankings', 'alltime'])]: [
        { name: 'Lars', points: 1530, position: 1, numberOfGames: 10 },
        { name: 'Joan', points: 1510, position: 2, numberOfGames: 10 },
        { name: 'Frank', points: 1490, position: 3, numberOfGames: 10 },
      ],
    }

    const { container } = renderWithProviders(<Tournament />, { preloadedQueries })

    // Generate button is always present once players are loaded.
    await screen.findByRole('button', { name: /Generate/i })

    // Strip the live timer text — it ticks once per second and is not stable.
    container.querySelectorAll('.time').forEach((el) => {
      el.textContent = '00:00'
    })

    expect(container.firstChild).toMatchSnapshot()
  })
})
