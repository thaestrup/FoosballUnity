import { describe, expect, it } from 'vitest'
import { GameListSchema, GameSchema } from '@/features/games/game'
import { PERIODS } from '@/lib/period'
import { PlayerListSchema } from '@/features/players/player'
import {
  CONTRACT_BASE,
  shouldRunContract,
  useLiveBackend,
} from './contractEnv'

// Build a minimal valid GameDto using two real player names. Returns
// null if there aren't enough seeded players; callers can early-return.
const buildSampleGame = async (): Promise<{
  body: Record<string, unknown>
  red1: string
  blue1: string
} | null> => {
  const playersRes = await fetch(`${CONTRACT_BASE}/players/`)
  const players = PlayerListSchema.parse(await playersRes.json())
  if (players.length < 2) return null
  const [a, b] = players
  return {
    red1: a.name,
    blue1: b.name,
    body: {
      player_red_1: a.name,
      player_red_2: null,
      player_blue_1: b.name,
      player_blue_2: null,
      lastUpdated: '2026-05-22 12:00:00.0',
      match_winner: 'red',
      points_at_stake: 10,
      winning_table: 1,
    },
  }
}

const postSampleGame = async (
  body: Record<string, unknown>,
): Promise<string> => {
  const res = await fetch(`${CONTRACT_BASE}/games/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([body]),
  })
  expect(res.ok).toBe(true)
  const parsed = (await res.json()) as { newGameIDs?: string[] }
  expect(parsed.newGameIDs?.length).toBeGreaterThan(0)
  return parsed.newGameIDs![0]
}

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

  // A 1v1 board (e.g. 6 ready players across 2 boards → board 2 is a
  // 1v1) has JSON null on the back-row slots in the POST payload. The
  // backend stores them as the literal `"null"` string for read-side
  // compatibility with `GameSchema`'s transform that maps `"null"` → JS
  // null. See FINDINGS-backend.md "Legacy parity quirks".
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

  it('PUT /games/{id} replaces editable fields but preserves id and timestamp', async () => {
    const sample = await buildSampleGame()
    if (!sample) return
    const id = await postSampleGame(sample.body)

    // Read it back so we can compare the timestamp afterwards.
    const listBefore = GameListSchema.parse(
      await (await fetch(`${CONTRACT_BASE}/games/alltime`)).json(),
    )
    const before = listBefore.find((g) => String(g.id) === id)
    expect(before).toBeDefined()
    const originalTimestamp = before!.lastUpdated

    // PUT with a different winner and an obviously-bogus future timestamp;
    // the backend should silently ignore both id-in-body and lastUpdated.
    const putRes = await fetch(`${CONTRACT_BASE}/games/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...sample.body,
        id: 999_999, // ignored — id comes from the path
        lastUpdated: '2099-01-01 00:00:00.0', // ignored — preserved from row
        match_winner: 'blue',
        points_at_stake: 42,
        winning_table: 3,
      }),
    })
    expect(putRes.ok).toBe(true)
    expect(putRes.headers.get('content-type')).toMatch(/application\/json/)

    const updated = GameSchema.parse(await putRes.json())
    expect(String(updated.id)).toBe(id)
    expect(updated.match_winner).toBe('blue')
    expect(updated.points_at_stake).toBe(42)
    expect(updated.winning_table).toBe(3)
    expect(updated.lastUpdated).toBe(originalTimestamp)
    expect(updated.lastUpdated).not.toMatch(/^2099/)
  })

  it('DELETE /games/{id} soft-deletes; the game vanishes; re-DELETE is 404', async () => {
    const sample = await buildSampleGame()
    if (!sample) return
    const id = await postSampleGame(sample.body)

    const delRes = await fetch(`${CONTRACT_BASE}/games/${id}`, {
      method: 'DELETE',
    })
    expect(delRes.ok).toBe(true)
    const delText = await delRes.text()
    expect(delText).toContain(`deleteGame: ${id}`)

    // Confirm the soft-delete hid it from the list reads.
    const list = GameListSchema.parse(
      await (await fetch(`${CONTRACT_BASE}/games/alltime`)).json(),
    )
    expect(list.find((g) => String(g.id) === id)).toBeUndefined()

    // Second delete on the same id should be 404 — soft-deleted rows are
    // treated as gone for write-side identity checks too.
    const reDel = await fetch(`${CONTRACT_BASE}/games/${id}`, {
      method: 'DELETE',
    })
    expect(reDel.status).toBe(404)
  })

  it('PUT /games/{id} on a non-existent id returns 404', async () => {
    const sample = await buildSampleGame()
    if (!sample) return
    const putRes = await fetch(`${CONTRACT_BASE}/games/999999999`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...sample.body, match_winner: 'red' }),
    })
    expect(putRes.status).toBe(404)
  })
})
