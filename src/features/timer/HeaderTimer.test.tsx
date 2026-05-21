import {
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { renderWithProviders } from '@/test/render'
import { makeTimer, resetFactoryIds } from '@/test/factories'
import { HeaderTimer } from './HeaderTimer'

const BASE = 'http://localhost:5050'

beforeAll(() => {
  vi.spyOn(window.HTMLMediaElement.prototype, 'play').mockResolvedValue(
    undefined,
  )
  vi.spyOn(window.HTMLMediaElement.prototype, 'load').mockImplementation(
    () => {},
  )
})

// Same module-cache reset trick used in Countdown.test.tsx.
const seedStoredJSON = async (key: string, value: unknown): Promise<void> => {
  const { useStoredJSON } = await import('@/lib/useStoredJSON')
  const { renderHook, act } = await import('@testing-library/react')
  const { result } = renderHook(() => useStoredJSON<unknown>(key, undefined))
  act(() => {
    result.current[1](value)
  })
}

beforeEach(async () => {
  resetFactoryIds()
  window.sessionStorage.clear()
  await seedStoredJSON('timer:duration', 120)
  await seedStoredJSON('timer:activeDuration', 120)
  await seedStoredJSON('timer:started', false)
  await seedStoredJSON('timer:resetAt', 0)
  await seedStoredJSON('timer:trackedKey', null)
  window.sessionStorage.clear()
})

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

describe('HeaderTimer — visibility', () => {
  it('renders nothing when started=false (default state)', async () => {
    const { container } = renderWithProviders(<HeaderTimer />)
    // The component returns null until something writes started=true.
    // Wait a tick so any initial useEffect can run.
    await Promise.resolve()
    // No <a> link rendered.
    expect(container.querySelector('a')).not.toBeInTheDocument()
  })

  it('renders the link when started=true', async () => {
    await seedStoredJSON('timer:duration', 120)
    await seedStoredJSON('timer:activeDuration', 120)
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

    renderWithProviders(<HeaderTimer />)

    const link = await screen.findByRole('link')
    expect(link).toBeInTheDocument()
    expect(link).toHaveAttribute('href', '/tournament')
  })
})

describe('HeaderTimer — phase classes', () => {
  const renderWithRemaining = async (opts: {
    duration: number
    elapsedSec: number
  }) => {
    await seedStoredJSON('timer:duration', opts.duration)
    await seedStoredJSON('timer:activeDuration', opts.duration)
    await seedStoredJSON('timer:started', true)
    await seedStoredJSON(
      'timer:resetAt',
      Date.now() - opts.elapsedSec * 1000,
    )
    await seedStoredJSON('timer:trackedKey', '2026-05-01 12:00:00.0')

    server.use(
      http.get(`${BASE}/timer`, () =>
        HttpResponse.json([
          makeTimer({ lastRequestedTimerStart: '2026-05-01 12:00:00.0' }),
        ]),
      ),
    )
    return renderWithProviders(<HeaderTimer />)
  }

  it('uses the normal phase when remaining > 60s', async () => {
    await renderWithRemaining({ duration: 120, elapsedSec: 30 }) // 90s left
    const link = await screen.findByRole('link')
    expect(link).toHaveClass('normal')
    expect(link).not.toHaveClass('warning')
    expect(link).not.toHaveClass('critical')
    expect(link).not.toHaveClass('finished')
  })

  it('uses the warning phase when 15 < remaining ≤ 60', async () => {
    await renderWithRemaining({ duration: 120, elapsedSec: 90 }) // 30s left
    const link = await screen.findByRole('link')
    expect(link).toHaveClass('warning')
  })

  it('uses the critical phase when 0 < remaining ≤ 15', async () => {
    await renderWithRemaining({ duration: 120, elapsedSec: 110 }) // 10s left
    const link = await screen.findByRole('link')
    expect(link).toHaveClass('critical')
  })

  it('uses the finished phase when remaining = 0', async () => {
    await renderWithRemaining({ duration: 30, elapsedSec: 60 }) // -30 → 0
    const link = await screen.findByRole('link')
    expect(link).toHaveClass('finished')
  })
})

describe('HeaderTimer — threshold sounds', () => {
  it('fires the right number of sounds as remaining crosses 60/30/15/0', async () => {
    // Real timers + setSystemTime + raw render trigger.
    // Strategy: don't use fake timers (msw/network would lock up). Instead,
    // mutate Date.now via vi.setSystemTime and force the local interval tick
    // by directly nudging `timer:resetAt` after each step — useStoredJSON is
    // subscribable and re-renders the component, which recomputes `remaining`
    // and runs the threshold-sound effect.

    const t0 = Date.now()
    await seedStoredJSON('timer:duration', 120)
    await seedStoredJSON('timer:activeDuration', 120)
    await seedStoredJSON('timer:started', true)
    await seedStoredJSON('timer:resetAt', t0)
    await seedStoredJSON('timer:trackedKey', '2026-05-01 12:00:00.0')

    server.use(
      http.get(`${BASE}/timer`, () =>
        HttpResponse.json([
          makeTimer({ lastRequestedTimerStart: '2026-05-01 12:00:00.0' }),
        ]),
      ),
    )

    const playSpy = window.HTMLMediaElement.prototype.play as unknown as ReturnType<
      typeof vi.fn
    >
    playSpy.mockClear()

    renderWithProviders(<HeaderTimer />)

    await waitFor(() => {
      expect(document.querySelector('a')).not.toBeNull()
    })

    // Helper: force the component to recompute by writing a fresh resetAt.
    // useStoredJSON notifies subscribers, triggering a re-render. We compute
    // resetAt as (now - elapsedMs) so that `remaining = duration - elapsed`
    // lands at a chosen value.
    const { useStoredJSON } = await import('@/lib/useStoredJSON')
    const { renderHook, act } = await import('@testing-library/react')
    const { result: setterHook } = renderHook(() =>
      useStoredJSON<number>('timer:resetAt', 0),
    )
    const setResetAt = setterHook.current[1]

    // Cross 60: place remaining at 59 (elapsed = 61s).
    await act(async () => {
      setResetAt(Date.now() - 61_000)
    })
    // Cross 30: remaining = 29 (elapsed = 91s).
    await act(async () => {
      setResetAt(Date.now() - 91_000)
    })
    // Cross 15: remaining = 14 (elapsed = 106s).
    await act(async () => {
      setResetAt(Date.now() - 106_000)
    })
    // Cross 0: remaining = 0 (elapsed >= 120s).
    await act(async () => {
      setResetAt(Date.now() - 121_000)
    })

    // Four threshold plays: 60, 30, 15, 0.
    expect(playSpy).toHaveBeenCalledTimes(4)
    // Avoid an unused-var warning for t0.
    void t0
  })

  it('does NOT fire any threshold sound when started=false', async () => {
    // Default beforeEach already sets started=false.
    const playSpy = window.HTMLMediaElement.prototype.play as unknown as ReturnType<
      typeof vi.fn
    >
    playSpy.mockClear()

    renderWithProviders(<HeaderTimer />)

    // Give effects a chance to run.
    await Promise.resolve()
    await Promise.resolve()

    expect(playSpy).not.toHaveBeenCalled()
  })
})

describe('HeaderTimer — snapshot', () => {
  it('matches snapshot when running with > 60s remaining', async () => {
    await seedStoredJSON('timer:duration', 120)
    await seedStoredJSON('timer:activeDuration', 120)
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

    const { container } = renderWithProviders(<HeaderTimer />)
    const link = await screen.findByRole('link')
    // Replace the volatile time text so the snapshot is stable.
    const timeSpan = link.querySelector('.time')
    if (timeSpan) timeSpan.textContent = 'M:SS'
    expect(container.firstChild).toMatchSnapshot()
  })

  it('matches snapshot when started=false (renders nothing)', async () => {
    const { container } = renderWithProviders(<HeaderTimer />)
    await Promise.resolve()
    expect(container.firstChild).toMatchSnapshot()
  })
})
