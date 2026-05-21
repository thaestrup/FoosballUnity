import { describe, expect, it } from 'vitest'
import { TimerActionListSchema } from '@/features/timer/timer'
import {
  CONTRACT_BASE,
  shouldRunContract,
  useLiveBackend,
} from './contractEnv'

describe.skipIf(!shouldRunContract)('contract: timer', () => {
  useLiveBackend()

  it('GET /timer matches TimerActionListSchema', async () => {
    const res = await fetch(`${CONTRACT_BASE}/timer`)
    expect(res.ok).toBe(true)
    const data: unknown = await res.json()
    const parsed = TimerActionListSchema.parse(data)
    expect(Array.isArray(parsed)).toBe(true)
    // Sanity: if there's at least one entry it should have an id and a
    // lastRequestedTimerStart string.
    if (parsed.length > 0) {
      expect(typeof parsed[0].id).toBe('number')
      expect(typeof parsed[0].lastRequestedTimerStart).toBe('string')
    }
  })

  // Re-confirmed in use 2026-05-14: Countdown.tsx mounts useResetTimer.
  // POST /timer is plain-text reply ("result: 1"); the api() wrapper falls
  // through to text on JSON.parse failure, so we just check the response is
  // 2xx and the next GET reflects an advanced timestamp.
  it('POST /timer advances lastRequestedTimerStart', async () => {
    const beforeRes = await fetch(`${CONTRACT_BASE}/timer`)
    const beforeData: unknown = await beforeRes.json()
    const beforeParsed = TimerActionListSchema.parse(beforeData)
    expect(beforeParsed.length).toBeGreaterThan(0)
    const before = beforeParsed[0].lastRequestedTimerStart

    // MariaDB TIMESTAMP precision is per-second by default. Sleep just past
    // a second so NOW() ticks before we POST.
    await new Promise((r) => setTimeout(r, 1100))

    const postRes = await fetch(`${CONTRACT_BASE}/timer`, { method: 'POST' })
    expect(postRes.ok).toBe(true)
    expect(postRes.status).toBe(200)

    const afterRes = await fetch(`${CONTRACT_BASE}/timer`)
    const afterData: unknown = await afterRes.json()
    const afterParsed = TimerActionListSchema.parse(afterData)
    expect(afterParsed.length).toBeGreaterThan(0)
    const after = afterParsed[0].lastRequestedTimerStart

    // Legacy Timestamp.toString() format is lexicographically orderable.
    expect(after.localeCompare(before)).toBeGreaterThan(0)
  })
})
