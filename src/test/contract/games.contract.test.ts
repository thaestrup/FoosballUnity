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

  // Regression test for the 500 a 1v1 game POST used to throw against the
  // Quarkus port: the React ReportGameForm sends JSON null on the back-row
  // slots when reporting a board that the `randomTournament` algorithm
  // produced as a 1v1 (e.g. 6 ready players across 2 boards → board 2 is
  // a 1v1 with the back slots returned as the legacy `"null"`-string
  // sentinel, then re-serialized as JSON null by the frontend Zod
  // transform). The backend has to accept null in those slots and store
  // them as the `"null"` string for compat with `GameSchema`'s read-side
  // transform. See FINDINGS-backend.md "Legacy parity quirks".
  it('POST /games/ accepts a 1v1 game with null back slots', async () => {
    const playersRes = await fetch(`${CONTRACT_BASE}/players/`)
    const players = PlayerListSchema.parse(await playersRes.json())
    if (players.length < 2) return // need at least 2 named players
    const [a, b] = players

    const body = [
      {
        player_red_1: a.name,
        player_red_2: null,
        player_blue_1: b.name,
        player_blue_2: null,
        lastUpdated: '2026-05-14 17:00:00.0',
        match_winner: 'red',
        points_at_stake: 25,
        winning_table: 2,
      },
    ]
    const postRes = await fetch(`${CONTRACT_BASE}/games/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    expect(postRes.ok).toBe(true)
    const postBody = (await postRes.json()) as { newGameIDs?: string[] }
    expect(postBody.newGameIDs?.length).toBeGreaterThan(0)
    const newId = postBody.newGameIDs![0]

    // Verify the round-trip: the new row must parse cleanly through
    // GameListSchema (which transforms "null" strings → JS null on the
    // back slots).
    const listRes = await fetch(`${CONTRACT_BASE}/games/alltime`)
    expect(listRes.ok).toBe(true)
    const parsed = GameListSchema.parse(await listRes.json())
    const created = parsed.find((g) => String(g.id) === newId)
    expect(created).toBeDefined()
    expect(created!.player_red_2).toBeNull()
    expect(created!.player_blue_2).toBeNull()
  })
})
