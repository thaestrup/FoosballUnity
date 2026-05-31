import { beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { renderWithProviders } from '@/test/render'
import { makePlayer, resetFactoryIds } from '@/test/factories'
import { SelectedFacepile } from './SelectedFacepile'

const BASE = 'http://localhost:5050'

beforeEach(() => {
  resetFactoryIds()
})

describe('SelectedFacepile — empty state', () => {
  it('renders "No players selected" label and "0 ready" count when nobody is ready', async () => {
    server.use(
      http.get(`${BASE}/players/`, () =>
        HttpResponse.json([
          makePlayer({ name: 'Lars', playerReady: false }),
          makePlayer({ name: 'Joan', playerReady: false }),
        ]),
      ),
    )

    renderWithProviders(<SelectedFacepile />)

    const link = await screen.findByRole('link', { name: 'No players selected' })
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/players')
    expect(screen.getByText('0 ready')).toBeInTheDocument()
    // No avatars when nobody is selected.
    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})

describe('SelectedFacepile — some selected', () => {
  it('renders an avatar for each selected player and a singular "1 player ready" label', async () => {
    server.use(
      http.get(`${BASE}/players/`, () =>
        HttpResponse.json([
          makePlayer({ name: 'Lars', playerReady: true }),
          makePlayer({ name: 'Joan', playerReady: false }),
        ]),
      ),
    )

    renderWithProviders(<SelectedFacepile />)

    const link = await screen.findByRole('link', { name: '1 player ready' })
    expect(link).toBeInTheDocument()
    // One avatar img for Lars.
    await waitFor(() => {
      const imgs = link.querySelectorAll('img')
      expect(imgs.length).toBe(1)
      // Avatar now points at the backend photo endpoint; the response is
      // 404 by default (no photo) which is fine — we're asserting the URL
      // shape only, not the render fallback.
      expect(imgs[0].getAttribute('src')).toMatch(
        /\/players\/Lars\/photo\?v=\d+$/,
      )
    })
    expect(screen.getByText('1 ready')).toBeInTheDocument()
  })

  it('uses the plural form when more than one player is ready', async () => {
    server.use(
      http.get(`${BASE}/players/`, () =>
        HttpResponse.json([
          makePlayer({ name: 'Lars', playerReady: true }),
          makePlayer({ name: 'Joan', playerReady: true }),
        ]),
      ),
    )

    renderWithProviders(<SelectedFacepile />)
    expect(await screen.findByRole('link', { name: '2 players ready' })).toBeInTheDocument()
  })
})

describe('SelectedFacepile — many (overflow)', () => {
  it('shows at most MAX_AVATARS faces and an overflow badge for the rest', async () => {
    server.use(
      http.get(`${BASE}/players/`, () =>
        HttpResponse.json([
          makePlayer({ name: 'A', playerReady: true }),
          makePlayer({ name: 'B', playerReady: true }),
          makePlayer({ name: 'C', playerReady: true }),
          makePlayer({ name: 'D', playerReady: true }),
          makePlayer({ name: 'E', playerReady: true }),
          makePlayer({ name: 'F', playerReady: true }),
        ]),
      ),
    )

    renderWithProviders(<SelectedFacepile />)

    const link = await screen.findByRole('link', { name: '6 players ready' })
    await waitFor(() => {
      expect(link.querySelectorAll('img').length).toBe(4)
    })
    expect(screen.getByText('+2')).toBeInTheDocument()
    expect(screen.getByText('6 ready')).toBeInTheDocument()
  })
})

describe('SelectedFacepile — snapshot', () => {
  it('matches snapshot with two selected players', async () => {
    server.use(
      http.get(`${BASE}/players/`, () =>
        HttpResponse.json([
          makePlayer({ name: 'Lars', playerReady: true }),
          makePlayer({ name: 'Joan', playerReady: true }),
          makePlayer({ name: 'Frank', playerReady: false }),
        ]),
      ),
    )

    const { container } = renderWithProviders(<SelectedFacepile />)
    await screen.findByRole('link', { name: '2 players ready' })
    expect(container.firstChild).toMatchSnapshot()
  })
})
