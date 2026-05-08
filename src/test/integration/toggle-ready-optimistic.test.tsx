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

describe('integration: optimistic toggle-ready', () => {
  it('flips the card to ready immediately on click, before the PUT resolves', async () => {
    const user = userEvent.setup()
    const seenPuts: Array<{ name: string; body: { playerReady: boolean } }> = []

    // Hold the PUT open so we can assert state purely from optimistic update.
    server.use(
      http.get(`${BASE}/players/`, () =>
        HttpResponse.json([
          makePlayer({ name: 'Frank', playerReady: false }),
          makePlayer({ name: 'Joan', playerReady: false }),
        ]),
      ),
      http.put(`${BASE}/players/:name`, async ({ request, params }) => {
        seenPuts.push({
          name: String(params.name),
          body: (await request.json()) as { playerReady: boolean },
        })
        // Stall so we can observe pre-response state.
        await delay(500)
        return HttpResponse.text('overwritePlayer: X, result: 1')
      }),
    )

    renderWithProviders(<PlayersList />)

    const frankText = await screen.findByText('Frank')
    const card = frankText.closest('button')!
    expect(card).toHaveAttribute('aria-pressed', 'false')

    await user.click(card)

    // The optimistic update must have already flipped aria-pressed to "true"
    // synchronously after click — without waiting for the PUT to resolve.
    expect(card).toHaveAttribute('aria-pressed', 'true')
    expect(card).toHaveClass('selected')

    // And the request was actually issued.
    expect(seenPuts).toHaveLength(1)
    expect(seenPuts[0].name).toBe('Frank')
    expect(seenPuts[0].body).toMatchObject({ playerReady: true })
  })
})
