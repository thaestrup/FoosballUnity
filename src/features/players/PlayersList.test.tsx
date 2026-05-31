import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { renderWithProviders } from '@/test/render'
import { makePlayer, resetFactoryIds } from '@/test/factories'
import { PlayersList } from './PlayersList'

const BASE = 'http://localhost:5050'

// jsdom does not implement <dialog>.showModal/close. Shim them so the Dialog
// component can be opened in tests without throwing.
const installDialogShim = () => {
  const proto = HTMLDialogElement.prototype as unknown as {
    showModal: () => void
    close: () => void
  }
  proto.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
    Object.defineProperty(this, 'open', { configurable: true, value: true })
  }
  proto.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open')
    Object.defineProperty(this, 'open', { configurable: true, value: false })
  }
}

beforeEach(() => {
  resetFactoryIds()
  installDialogShim()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('PlayersList — render', () => {
  it('renders the list of players returned from the backend', async () => {
    // Default handler returns Lars, Joan (ready) + Frank, Daniel (not ready).
    renderWithProviders(<PlayersList />)

    expect(await screen.findByText('Lars')).toBeInTheDocument()
    expect(screen.getByText('Joan')).toBeInTheDocument()
    expect(screen.getByText('Frank')).toBeInTheDocument()
    expect(screen.getByText('Daniel')).toBeInTheDocument()
  })

  it('shows the ready/total count', async () => {
    renderWithProviders(<PlayersList />)
    expect(await screen.findByText('2 / 4 selected')).toBeInTheDocument()
  })

  it('shows a loading state initially', async () => {
    renderWithProviders(<PlayersList />)
    // Router mounts asynchronously, so wait for the loading text rather than
    // grabbing it synchronously.
    expect(await screen.findByText(/loading players/i)).toBeInTheDocument()
  })

  it('shows an error state when /players/ fails', async () => {
    server.use(
      http.get(`${BASE}/players/`, () => HttpResponse.text('boom', { status: 500 })),
    )
    renderWithProviders(<PlayersList />)
    expect(await screen.findByText(/couldn't load players/i)).toBeInTheDocument()
  })
})

describe('PlayersList — sort and recency badge', () => {
  it('orders players alphabetically by name', async () => {
    server.use(
      http.get(`${BASE}/players/`, () =>
        HttpResponse.json([
          makePlayer({ name: 'Alpha', playerReady: false }),
          makePlayer({ name: 'Beta', playerReady: false }),
          makePlayer({ name: 'Gamma', playerReady: false }),
          makePlayer({ name: 'Delta', playerReady: false }),
        ]),
      ),
    )

    renderWithProviders(<PlayersList />)

    await screen.findByText('Alpha')
    const items = screen.getAllByRole('button', { pressed: false })
    const names = items
      .map((b) => b.querySelector('.name')?.textContent)
      .filter((n): n is string => Boolean(n))

    expect(names).toEqual(['Alpha', 'Beta', 'Delta', 'Gamma'])
  })

  it('shows a corner dot for players who played in the last 30 days', async () => {
    const now = Date.now()
    const recent = now - 5 * 24 * 60 * 60 * 1000 // 5 days ago
    const stale = now - 90 * 24 * 60 * 60 * 1000 // 90 days ago

    server.use(
      http.get(`${BASE}/players/`, () =>
        HttpResponse.json([
          makePlayer({ name: 'RecentPlayer', playerReady: false }),
          makePlayer({ name: 'StalePlayer', playerReady: false }),
          makePlayer({ name: 'NeverPlayed', playerReady: false }),
        ]),
      ),
      http.get(`${BASE}/statisticsPlayersLastPlayed/`, () =>
        HttpResponse.json({ RecentPlayer: recent, StalePlayer: stale }),
      ),
    )

    renderWithProviders(<PlayersList />)

    await screen.findByText('RecentPlayer')

    // The recent player's card has the corner dot; the others don't.
    const recentCard = screen.getByText('RecentPlayer').closest('button')
    const staleCard = screen.getByText('StalePlayer').closest('button')
    const neverCard = screen.getByText('NeverPlayed').closest('button')

    expect(
      recentCard?.querySelector('[aria-label="Played in the last 30 days"]'),
    ).toBeTruthy()
    expect(
      staleCard?.querySelector('[aria-label="Played in the last 30 days"]'),
    ).toBeFalsy()
    expect(
      neverCard?.querySelector('[aria-label="Played in the last 30 days"]'),
    ).toBeFalsy()
  })
})

describe('PlayersList — toggle interactions', () => {
  it('toggles a player ready when their card is clicked (PUT issued)', async () => {
    const user = userEvent.setup()
    const puts: Array<{ url: string; body: unknown }> = []
    server.use(
      http.put(`${BASE}/players/:name`, async ({ request, params }) => {
        puts.push({ url: String(params.name), body: await request.json() })
        return HttpResponse.text('overwritePlayer: X, result: 1')
      }),
    )

    renderWithProviders(<PlayersList />)

    const frankCard = (await screen.findByText('Frank')).closest('button')!
    await user.click(frankCard)

    await waitFor(() => expect(puts).toHaveLength(1))
    expect(puts[0].url).toBe('Frank')
    expect(puts[0].body).toMatchObject({ name: 'Frank', playerReady: true })
  })
})

describe('PlayersList — Select all / Clear all', () => {
  it('disables Select all when everyone is ready', async () => {
    server.use(
      http.get(`${BASE}/players/`, () =>
        HttpResponse.json([
          makePlayer({ name: 'A', playerReady: true }),
          makePlayer({ name: 'B', playerReady: true }),
        ]),
      ),
    )

    renderWithProviders(<PlayersList />)

    const selectAll = await screen.findByRole('button', { name: 'Select all' })
    expect(selectAll).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Clear all' })).toBeEnabled()
  })

  it('disables Clear all when nobody is ready', async () => {
    server.use(
      http.get(`${BASE}/players/`, () =>
        HttpResponse.json([
          makePlayer({ name: 'A', playerReady: false }),
          makePlayer({ name: 'B', playerReady: false }),
        ]),
      ),
    )

    renderWithProviders(<PlayersList />)

    const clearAll = await screen.findByRole('button', { name: 'Clear all' })
    expect(clearAll).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Select all' })).toBeEnabled()
  })

  it('PUTs only the players that need flipping when Select all is clicked', async () => {
    const user = userEvent.setup()
    const puts: string[] = []
    server.use(
      http.get(`${BASE}/players/`, () =>
        HttpResponse.json([
          makePlayer({ name: 'A', playerReady: true }),
          makePlayer({ name: 'B', playerReady: false }),
          makePlayer({ name: 'C', playerReady: false }),
        ]),
      ),
      http.put(`${BASE}/players/:name`, ({ params }) => {
        puts.push(String(params.name))
        return HttpResponse.text('overwritePlayer: X, result: 1')
      }),
    )

    renderWithProviders(<PlayersList />)

    await user.click(await screen.findByRole('button', { name: 'Select all' }))

    await waitFor(() => expect(puts.length).toBe(2))
    expect(puts.sort()).toEqual(['B', 'C'])
  })

  it('PUTs only the ready players when Clear all is clicked', async () => {
    const user = userEvent.setup()
    const puts: string[] = []
    server.use(
      http.get(`${BASE}/players/`, () =>
        HttpResponse.json([
          makePlayer({ name: 'A', playerReady: true }),
          makePlayer({ name: 'B', playerReady: true }),
          makePlayer({ name: 'C', playerReady: false }),
        ]),
      ),
      http.put(`${BASE}/players/:name`, ({ params }) => {
        puts.push(String(params.name))
        return HttpResponse.text('overwritePlayer: X, result: 1')
      }),
    )

    renderWithProviders(<PlayersList />)

    await user.click(await screen.findByRole('button', { name: 'Clear all' }))

    await waitFor(() => expect(puts.length).toBe(2))
    expect(puts.sort()).toEqual(['A', 'B'])
  })
})

describe('PlayersList — FAB → Dialog → AddPlayerForm flow', () => {
  it('opens the Add player dialog when the FAB is clicked', async () => {
    const user = userEvent.setup()
    renderWithProviders(<PlayersList />)

    await screen.findByText('Lars')

    await user.click(screen.getByRole('button', { name: 'Add player' }))

    expect(await screen.findByPlaceholderText('Player name')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument()
  })

  it('closes the dialog when the cancel button is clicked', async () => {
    const user = userEvent.setup()
    const { container } = renderWithProviders(<PlayersList />)

    await screen.findByText('Lars')
    await user.click(screen.getByRole('button', { name: 'Add player' }))

    // Dialog has been opened — `open` attribute is set by the shim.
    await waitFor(() => {
      expect(container.querySelector('dialog')).toHaveAttribute('open')
    })

    await user.click(await screen.findByRole('button', { name: 'Cancel' }))

    // After cancel, the AddPlayerForm calls onCancel → setAddOpen(false), which
    // calls dialog.close() (our shim removes the `open` attribute).
    await waitFor(() => {
      expect(container.querySelector('dialog')).not.toHaveAttribute('open')
    })
  })

  it('after a successful add: closes the dialog, highlights the new card, scrolls into view', async () => {
    const user = userEvent.setup()
    // jsdom doesn't ship scrollIntoView. Define it before spying so spyOn
    // has a property to wrap.
    if (!('scrollIntoView' in Element.prototype)) {
      ;(Element.prototype as unknown as { scrollIntoView: () => void })
        .scrollIntoView = () => {}
    }
    const scrollSpy = vi
      .spyOn(Element.prototype, 'scrollIntoView')
      .mockImplementation(() => {})

    // GET /players/ adds "Newbie" only after the POST has occurred.
    let posted = false
    server.use(
      http.get(`${BASE}/players/`, () => {
        const base = [
          makePlayer({ name: 'Lars', playerReady: true }),
          makePlayer({ name: 'Joan', playerReady: false }),
        ]
        if (posted) {
          base.push(makePlayer({ name: 'Newbie', playerReady: true }))
        }
        return HttpResponse.json(base)
      }),
      http.post(`${BASE}/players/`, () => {
        posted = true
        return HttpResponse.text('insertPlayer: Newbie, result: 1')
      }),
    )

    const { container } = renderWithProviders(<PlayersList />)

    await screen.findByText('Lars')
    await user.click(screen.getByRole('button', { name: 'Add player' }))

    const input = await screen.findByPlaceholderText('Player name')
    await user.type(input, 'Newbie')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    // Dialog closes — `open` attribute is removed by our shim.
    await waitFor(() => {
      expect(container.querySelector('dialog')).not.toHaveAttribute('open')
    })

    // New card appears.
    const newCard = await screen.findByText('Newbie')
    expect(newCard).toBeInTheDocument()

    // scrollIntoView fires once the highlighted player is in the rendered list.
    await waitFor(() => {
      expect(scrollSpy).toHaveBeenCalled()
    })

    // The highlighted card uses the .highlight class. The li now also
    // contains a per-card Edit button, so scope to the toggle button by
    // its aria-pressed attribute.
    const li = newCard.closest('li')!
    const toggleBtn = within(li).getByRole('button', { pressed: true })
    expect(toggleBtn).toHaveClass('highlight')
  })
})

describe('PlayersList — snapshot', () => {
  it('matches snapshot with the default mocked player list', async () => {
    // Pin lastPlayed so sort order is deterministic.
    server.use(
      http.get(`${BASE}/statisticsPlayersLastPlayed/`, () =>
        HttpResponse.json({}),
      ),
    )
    const { container } = renderWithProviders(<PlayersList />)
    await screen.findByText('Lars')
    // Wait for everyone so the snapshot is stable.
    await screen.findByText('Daniel')
    expect(container.firstChild).toMatchSnapshot()
  })
})
