import { describe, expect, it } from 'vitest'
import {
  LastPlayedSchema,
  PlayerListSchema,
} from '@/features/players/player'
import {
  CONTRACT_BASE,
  shouldRunContract,
  useLiveBackend,
} from './contractEnv'

describe.skipIf(!shouldRunContract)('contract: players', () => {
  useLiveBackend()

  it('GET /players/ matches PlayerListSchema', async () => {
    const res = await fetch(`${CONTRACT_BASE}/players/`)
    expect(res.ok).toBe(true)
    const data: unknown = await res.json()
    const parsed = PlayerListSchema.parse(data)
    expect(Array.isArray(parsed)).toBe(true)
    // Sanity: every entry should at least have a non-empty name string.
    for (const p of parsed) {
      expect(typeof p.name).toBe('string')
      expect(p.name.length).toBeGreaterThan(0)
    }
  })

  it('GET /statisticsPlayersLastPlayed/ matches LastPlayedSchema', async () => {
    const res = await fetch(`${CONTRACT_BASE}/statisticsPlayersLastPlayed/`)
    expect(res.ok).toBe(true)
    const data: unknown = await res.json()
    const parsed = LastPlayedSchema.parse(data)
    // Record<string, number>. Don't require any specific keys (table may
    // be empty in fresh installs), just verify the value type for each.
    for (const [name, ts] of Object.entries(parsed)) {
      expect(typeof name).toBe('string')
      expect(typeof ts).toBe('number')
    }
  })
})
