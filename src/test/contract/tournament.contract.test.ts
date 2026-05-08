import { describe, expect, it } from 'vitest'
import { PlayerListSchema } from '@/features/players/player'
import {
  FlatTournamentSchema,
  RoundedTournamentSchema,
} from '@/features/tournament/tournament'
import {
  CONTRACT_BASE,
  shouldRunContract,
  useLiveBackend,
} from './contractEnv'

/**
 * Build a canonical tournament request body from the live `/players/` list:
 * 4 real players + numberOfGames=1.
 *
 * The backend's `GamesPostRequest` deserializes `players` as `Player[]`
 * (full objects), not strings — so we pass the objects through verbatim.
 */
const buildRequest = async (): Promise<{
  numberOfGames: number
  players: unknown[]
} | null> => {
  const res = await fetch(`${CONTRACT_BASE}/players/`)
  if (!res.ok) return null
  const players = PlayerListSchema.parse(await res.json())
  if (players.length < 4) return null
  return { numberOfGames: 1, players: players.slice(0, 4) }
}

describe.skipIf(!shouldRunContract)('contract: tournament', () => {
  useLiveBackend()

  it('POST /tournament/randomTournament/ matches FlatTournamentSchema', async () => {
    const body = await buildRequest()
    expect(body, 'Need at least 4 players in the live DB').not.toBeNull()
    const res = await fetch(`${CONTRACT_BASE}/tournament/randomTournament/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    expect(res.ok).toBe(true)
    const data: unknown = await res.json()
    const parsed = FlatTournamentSchema.parse(data)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed.length).toBeGreaterThan(0)
  })

  it('POST /tournament/lastFirstTournament/ matches RoundedTournamentSchema', async () => {
    const body = await buildRequest()
    expect(body, 'Need at least 4 players in the live DB').not.toBeNull()
    const res = await fetch(`${CONTRACT_BASE}/tournament/lastFirstTournament/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    expect(res.ok).toBe(true)
    const data: unknown = await res.json()
    const parsed = RoundedTournamentSchema.parse(data)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed.length).toBeGreaterThan(0)
    expect(parsed[0].tournamentGames.length).toBeGreaterThan(0)
  })

  it('POST /tournament/awesomeAlgorithmTournament/ matches RoundedTournamentSchema', async () => {
    const body = await buildRequest()
    expect(body, 'Need at least 4 players in the live DB').not.toBeNull()
    const res = await fetch(
      `${CONTRACT_BASE}/tournament/awesomeAlgorithmTournament/`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    )
    expect(res.ok).toBe(true)
    const data: unknown = await res.json()
    const parsed = RoundedTournamentSchema.parse(data)
    expect(Array.isArray(parsed)).toBe(true)
    expect(parsed.length).toBeGreaterThan(0)
    expect(parsed[0].tournamentGames.length).toBeGreaterThan(0)
  })
})
