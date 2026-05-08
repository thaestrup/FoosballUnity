import { describe, expect, it } from 'vitest'
import { GameListSchema } from '@/features/games/game'
import { PERIODS } from '@/lib/period'
import { PlayerListSchema } from '@/features/players/player'
import {
  CONTRACT_BASE,
  shouldRunContract,
  useLiveBackend,
} from './contractEnv'

describe.skipIf(!shouldRunContract)('contract: games', () => {
  useLiveBackend()

  for (const period of PERIODS) {
    it(`GET /games/${period} matches GameListSchema`, async () => {
      const res = await fetch(`${CONTRACT_BASE}/games/${period}`)
      expect(res.ok).toBe(true)
      const data: unknown = await res.json()
      const parsed = GameListSchema.parse(data)
      expect(Array.isArray(parsed)).toBe(true)
    })
  }

  it('GET /games/{playerName} matches GameListSchema', async () => {
    // Fetch a real player name to avoid hard-coding fixture data that may
    // disappear from a fresh DB seed. Falls back gracefully if the player
    // table is empty.
    const playersRes = await fetch(`${CONTRACT_BASE}/players/`)
    const players = PlayerListSchema.parse(await playersRes.json())
    if (players.length === 0) {
      // Nothing to test against — accept and move on. The /players test
      // covers the empty-list case.
      return
    }
    const name = players[0].name
    const res = await fetch(
      `${CONTRACT_BASE}/games/${encodeURIComponent(name)}`,
    )
    expect(res.ok).toBe(true)
    const data: unknown = await res.json()
    const parsed = GameListSchema.parse(data)
    expect(Array.isArray(parsed)).toBe(true)
  })
})
