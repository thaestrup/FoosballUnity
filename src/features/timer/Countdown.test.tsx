import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { renderWithProviders } from '@/test/render'
import { makeTimer, resetFactoryIds } from '@/test/factories'
import { Countdown } from './Countdown'

const BASE = 'http://localhost:5050'

// useStoredJSON has a process-wide in-memory cache that overrides
// sessionStorage reads. Importing it here lets us load fresh values from
// sessionStorage by writing them via the hook's setter (a small helper below).
const seedStoredJSON = async (key: string, value: unknown): Promise<void> => {
  // Easiest path: write to sessionStorage AND into the module's cache by
  // using the setter through a mounted hook. We don't have direct cache
  // access, so we use a transient render-once hook.
  const { useStoredJSON } = await import('@/lib/useStoredJSON')
  const { renderHook, act } = await import('@testing-library/react')
  const { result } = renderHook(() => useStoredJSON<unknown>(key, undefined))
  act(() => {
    result.current[1](value)
  })
}

// HTMLMediaElement isn't implemented by jsdom; stub play/load so the Duke
// audio block in Countdown doesn't blow up.
beforeAll(() => {
  vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue(
    undefined,
  )
  vi.spyOn(window.HTMLMediaElement.prototype, 'load').mockImplementation(
    () => {},
  )
})

beforeEach(async () => {
  resetFactoryIds()
  // Wipe persisted timer state between tests AND reset the in-memory cache
  // owned by useStoredJSON so tests start from a known-fresh baseline.
  window.sessionStorage.clear()
  await seedStoredJSON('timer:duration', 120)
  await seedStoredJSON('timer:started', false)
  await seedStoredJSON('timer:resetAt', 0)
  await seedStoredJSON('timer:trackedKey', null)
  // Re-clear sessionStorage so seeded values don't bleed back via storage.
  window.sessionStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('Countdown — initial render', () => {
  it('shows a loading state while the /timer query is in flight', async () => {
    server.use(
      http.get(`${BASE}/timer`, () => new Promise(() => {}) as unknown as Response),
    )
    renderWithProviders(<Countdown />)
    expect(await screen.findByText(/loading timer/i)).toBeInTheDocument()
  })

  it('shows the "ready" label when the timer has not been started', async () => {
    renderWithProviders(<Countdown />)
    expect(await screen.findByText('ready')).toBeInTheDocument()
    // Default duration is 120s → "2:00".
    expect(screen.getByText('2:00')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Start \/ Reset/i }),
    ).toBeInTheDocument()
  })

  it('renders the duration dropdown with 30/60/120 options and 120 selected by default', async () => {
    renderWithProviders(<Countdown />)
    const select = (await screen.findByRole('combobox')) as HTMLSelectElement
    const optionTexts = Array.from(select.options).map((o) => o.textContent)
    expect(optionTexts).toEqual(['30 s', '60 s', '120 s'])
    expect(select.value).toBe('120')
  })

  it('renders an error state when /timer fails', async () => {
    server.use(
      http.get(`${BASE}/timer`, () =>
        HttpResponse.text('boom', { status: 500 }),
      ),
    )
    renderWithProviders(<Countdown />)
    expect(await screen.findByText(/Failed to load timer/i)).toBeInTheDocument()
  })
})

describe('Countdown — Start/Reset', () => {
  it('POSTs /timer when Start/Reset is clicked', async () => {
    let posts = 0
    server.use(
      http.post(`${BASE}/timer`, () => {
        posts += 1
        return HttpResponse.text('result: 1')
      }),
    )

    const user = userEvent.setup()
    renderWithProviders(<Countdown />)

    const btn = await screen.findByRole('button', { name: /Start \/ Reset/i })
    await user.click(btn)

    await waitFor(() => expect(posts).toBe(1))
  })

  it('attempts to play a Duke sound when Start/Reset is clicked', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Countdown />)

    const playSpy = window.HTMLMediaElement.prototype.play as unknown as ReturnType<
      typeof vi.fn
    >
    playSpy.mockClear()

    const btn = await screen.findByRole('button', { name: /Start \/ Reset/i })
    await user.click(btn)

    await waitFor(() => expect(playSpy).toHaveBeenCalled())
  })
})

describe('Countdown — duration persistence', () => {
  it('writes the new duration to sessionStorage when changed', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Countdown />)

    const select = (await screen.findByRole('combobox')) as HTMLSelectElement
    await user.selectOptions(select, '60')

    expect(select.value).toBe('60')
    expect(window.sessionStorage.getItem('timer:duration')).toBe('60')
    // Display reflects the new duration when not started.
    expect(screen.getByText('1:00')).toBeInTheDocument()
  })

  it('reads the stored duration on initial render', async () => {
    await seedStoredJSON('timer:duration', 30)
    renderWithProviders(<Countdown />)

    const select = (await screen.findByRole('combobox')) as HTMLSelectElement
    expect(select.value).toBe('30')
    expect(screen.getByText('0:30')).toBeInTheDocument()
  })
})

describe('Countdown — display label transitions', () => {
  it('shows "left" when more than 60s remain', async () => {
    // Seed a "started" state with 90s remaining (duration 120, resetAt now-30s).
    await seedStoredJSON('timer:duration', 120)
    await seedStoredJSON('timer:started', true)
    await seedStoredJSON('timer:resetAt', Date.now() - 30_000)
    await seedStoredJSON('timer:trackedKey', '2026-05-01 12:00:00.0')

    server.use(
      http.get(`${BASE}/timer`, () =>
        HttpResponse.json([
          makeTimer({ lastRequestedTimerStart: '2026-05-01 12:00:00.0' }),
        ]),
      ),
    )

    renderWithProviders(<Countdown />)

    expect(await screen.findByText('left')).toBeInTheDocument()
  })

  it('shows "remaining" when 60s or fewer remain', async () => {
    await seedStoredJSON('timer:duration', 120)
    await seedStoredJSON('timer:started', true)
    // 100s elapsed → 20s remaining.
    await seedStoredJSON('timer:resetAt', Date.now() - 100_000)
    await seedStoredJSON('timer:trackedKey', '2026-05-01 12:00:00.0')

    server.use(
      http.get(`${BASE}/timer`, () =>
        HttpResponse.json([
          makeTimer({ lastRequestedTimerStart: '2026-05-01 12:00:00.0' }),
        ]),
      ),
    )

    renderWithProviders(<Countdown />)

    expect(await screen.findByText('remaining')).toBeInTheDocument()
  })

  it('shows "Time\'s up" when the duration has elapsed', async () => {
    await seedStoredJSON('timer:duration', 30)
    await seedStoredJSON('timer:started', true)
    // 60s elapsed → -30s remaining (clamps to 0 in display).
    await seedStoredJSON('timer:resetAt', Date.now() - 60_000)
    await seedStoredJSON('timer:trackedKey', '2026-05-01 12:00:00.0')

    server.use(
      http.get(`${BASE}/timer`, () =>
        HttpResponse.json([
          makeTimer({ lastRequestedTimerStart: '2026-05-01 12:00:00.0' }),
        ]),
      ),
    )

    renderWithProviders(<Countdown />)

    expect(await screen.findByText("Time's up")).toBeInTheDocument()
    // Display clamps to 0:00.
    expect(screen.getByText('0:00')).toBeInTheDocument()
  })
})

describe('Countdown — snapshot', () => {
  it('matches snapshot in the ready (not-started) state', async () => {
    const { container } = renderWithProviders(<Countdown />)
    await screen.findByText('ready')
    expect(container.firstChild).toMatchSnapshot()
  })
})
