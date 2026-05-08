import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse, delay } from 'msw'
import { server } from '@/test/server'
import { renderWithProviders } from '@/test/render'
import { installAllShims } from '@/test/shims'
import { makePlayer, resetFactoryIds } from '@/test/factories'
import { PlayersList } from '@/features/players/PlayersList'

const BASE = 'http://localhost:5050'

beforeEach(() => {
  resetFactoryIds()
  installAllShims()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('integration: optimistic set-all-ready', () => {
  it('flips every card to selected immediately on "Select all", before any PUT resolves', async () => {
    const user = userEvent.setup()
    let putsStarted = 0

    server.use(
      http.get(`${BASE}/players/`, () =>
        HttpResponse.json([
          makePlayer({ name: 'Lars', playerReady: false }),
          makePlayer({ name: 'Joan', playerReady: false }),
          makePlayer({ name: 'Frank', playerReady: false }),
          makePlayer({ name: 'Daniel', playerReady: false }),
        ]),
      ),
      // Stall every PUT so we can observe the pre-response cache state.
      http.put(`${BASE}/players/:name`, async () => {
        putsStarted += 1
        await delay(500)
        return HttpResponse.text('overwritePlayer: X, result: 1')
      }),
    )

    renderWithProviders(<PlayersList />)

    // Wait for the four cards.
    for (const name of ['Lars', 'Joan', 'Frank', 'Daniel']) {
      const text = await screen.findByText(name)
      expect(text.closest('button')).toHaveAttribute('aria-pressed', 'false')
    }

    await user.click(screen.getByRole('button', { name: 'Select all' }))

    // All four cards must show selected synchronously, while the PUTs are
    // still in flight (no response from MSW yet — putsStarted > 0).
    for (const name of ['Lars', 'Joan', 'Frank', 'Daniel']) {
      expect(screen.getByText(name).closest('button')).toHaveAttribute(
        'aria-pressed',
        'true',
      )
    }
    expect(putsStarted).toBeGreaterThan(0)
  })

  it('rolls every card back to its prior state if a PUT fails', async () => {
    const user = userEvent.setup()

    server.use(
      http.get(`${BASE}/players/`, () =>
        HttpResponse.json([
          makePlayer({ name: 'Lars', playerReady: false }),
          makePlayer({ name: 'Joan', playerReady: false }),
        ]),
      ),
      http.put(`${BASE}/players/:name`, () =>
        new HttpResponse('boom', { status: 500 }),
      ),
    )

    renderWithProviders(<PlayersList />)
    const lars = (await screen.findByText('Lars')).closest('button')!
    const joan = (await screen.findByText('Joan')).closest('button')!
    expect(lars).toHaveAttribute('aria-pressed', 'false')
    expect(joan).toHaveAttribute('aria-pressed', 'false')

    await user.click(screen.getByRole('button', { name: 'Select all' }))

    // After the mutation rejects + onError restores the snapshot, the cards
    // should be back to their original (not-ready) state.
    await vi.waitFor(() => {
      expect(lars).toHaveAttribute('aria-pressed', 'false')
      expect(joan).toHaveAttribute('aria-pressed', 'false')
    })
  })
})
