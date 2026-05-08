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
})
