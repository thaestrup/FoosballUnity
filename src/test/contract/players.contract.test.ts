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

// Backend caps `player.name` at 20 chars (jakarta @Size). Build a short
// random-ish suffix and clip the total length so insertions don't fail
// validation when the test runner is generating names.
const uniquePlayerName = (prefix: string): string => {
  const tail =
    Date.now().toString(36).slice(-6) +
    Math.random().toString(36).slice(2, 6)
  return `${prefix}-${tail}`.slice(0, 20)
}

const insertPlayer = async (name: string): Promise<void> => {
  const res = await fetch(`${CONTRACT_BASE}/players/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([
      {
        name,
        playerReady: false,
        oprettet: '2026-05-25 12:00:00.0',
        registeredRFIDTag: '',
      },
    ]),
  })
  if (!res.ok) {
    const body = await res.text().catch(() => '<no body>')
    throw new Error(`insertPlayer(${name}) → ${res.status}: ${body}`)
  }
}

const deletePlayer = async (name: string): Promise<void> => {
  // Best-effort cleanup; test harness shouldn't fail on cleanup errors.
  await fetch(`${CONTRACT_BASE}/players/${encodeURIComponent(name)}`, {
    method: 'DELETE',
  })
}

// 1×1 transparent PNG bytes. Tiny enough to upload quickly; the backend
// doesn't validate the PNG structure, just the Content-Type.
const TINY_PNG = new Uint8Array([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
  0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x63, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00, 0x49,
  0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
])

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

  it('PUT /players/{name}/rename moves the row and removes the old name', async () => {
    const oldName = uniquePlayerName('rn')
    const newName = uniquePlayerName('rn2')
    await insertPlayer(oldName)

    try {
      const res = await fetch(
        `${CONTRACT_BASE}/players/${encodeURIComponent(oldName)}/rename`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newName }),
        },
      )
      expect(res.ok).toBe(true)

      // Old name GET should now 404; new name should be visible.
      const list = PlayerListSchema.parse(
        await (await fetch(`${CONTRACT_BASE}/players/`)).json(),
      )
      expect(list.find((p) => p.name === oldName)).toBeUndefined()
      expect(list.find((p) => p.name === newName)).toBeDefined()
    } finally {
      await deletePlayer(newName)
    }
  })

  it('PUT /players/{name}/rename returns 409 when target name is taken', async () => {
    const a = uniquePlayerName('cnA')
    const b = uniquePlayerName('cnB')
    await insertPlayer(a)
    await insertPlayer(b)

    try {
      const res = await fetch(
        `${CONTRACT_BASE}/players/${encodeURIComponent(a)}/rename`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ newName: b }),
        },
      )
      expect(res.status).toBe(409)
    } finally {
      await deletePlayer(a)
      await deletePlayer(b)
    }
  })

  it('PUT /players/{name}/rename returns 404 for an unknown player', async () => {
    const phantom = uniquePlayerName('nx')
    const res = await fetch(
      `${CONTRACT_BASE}/players/${encodeURIComponent(phantom)}/rename`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newName: 'whatever' }),
      },
    )
    expect(res.status).toBe(404)
  })

  it('PUT /players/{name}/photo round-trips bytes, content-type, and is retrievable', async () => {
    const name = uniquePlayerName('ph')
    await insertPlayer(name)

    try {
      const putRes = await fetch(
        `${CONTRACT_BASE}/players/${encodeURIComponent(name)}/photo`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'image/png' },
          body: TINY_PNG,
        },
      )
      expect(putRes.ok).toBe(true)

      const getRes = await fetch(
        `${CONTRACT_BASE}/players/${encodeURIComponent(name)}/photo`,
      )
      expect(getRes.ok).toBe(true)
      expect(getRes.headers.get('content-type')).toMatch(/^image\/png/)
      const bytes = new Uint8Array(await getRes.arrayBuffer())
      expect(bytes.length).toBe(TINY_PNG.length)
      // Spot-check the PNG signature survived.
      expect(bytes[0]).toBe(0x89)
      expect(bytes[1]).toBe(0x50)
      expect(bytes[2]).toBe(0x4e)
      expect(bytes[3]).toBe(0x47)
    } finally {
      await deletePlayer(name)
    }
  })

  it('PUT /players/{name}/photo rejects text/plain with 415', async () => {
    const name = uniquePlayerName('pht')
    await insertPlayer(name)

    try {
      const res = await fetch(
        `${CONTRACT_BASE}/players/${encodeURIComponent(name)}/photo`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'text/plain' },
          body: 'not an image',
        },
      )
      expect(res.status).toBe(415)
    } finally {
      await deletePlayer(name)
    }
  })

  it('PUT /players/{name}/photo rejects > 2 MB body with 413', async () => {
    const name = uniquePlayerName('phs')
    await insertPlayer(name)

    try {
      // 2.1 MB of zeroed bytes — body content doesn't matter, only size.
      const body = new Uint8Array(2_100_000)
      const res = await fetch(
        `${CONTRACT_BASE}/players/${encodeURIComponent(name)}/photo`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'image/jpeg' },
          body,
        },
      )
      expect(res.status).toBe(413)
    } finally {
      await deletePlayer(name)
    }
  })

  it('DELETE /players/{name} hard-deletes the row and cascades to the photo', async () => {
    const name = uniquePlayerName('dpl')
    await insertPlayer(name)

    // Attach a photo so we can verify the cascade.
    const upRes = await fetch(
      `${CONTRACT_BASE}/players/${encodeURIComponent(name)}/photo`,
      {
        method: 'PUT',
        headers: { 'Content-Type': 'image/png' },
        body: TINY_PNG,
      },
    )
    expect(upRes.ok).toBe(true)

    const delRes = await fetch(
      `${CONTRACT_BASE}/players/${encodeURIComponent(name)}`,
      { method: 'DELETE' },
    )
    expect(delRes.ok).toBe(true)
    expect(await delRes.text()).toContain(`deletePlayer: ${name}`)

    // Player is gone from the list.
    const list = PlayerListSchema.parse(
      await (await fetch(`${CONTRACT_BASE}/players/`)).json(),
    )
    expect(list.find((p) => p.name === name)).toBeUndefined()

    // The photo cascaded — GET now 404s.
    const photoRes = await fetch(
      `${CONTRACT_BASE}/players/${encodeURIComponent(name)}/photo`,
    )
    expect(photoRes.status).toBe(404)

    // Re-deleting an already-deleted player is 404.
    const reDel = await fetch(
      `${CONTRACT_BASE}/players/${encodeURIComponent(name)}`,
      { method: 'DELETE' },
    )
    expect(reDel.status).toBe(404)
  })

  it('DELETE /players/{name}/photo removes the photo; subsequent GET is 404', async () => {
    const name = uniquePlayerName('phd')
    await insertPlayer(name)

    try {
      // Upload first so there's something to delete.
      const upRes = await fetch(
        `${CONTRACT_BASE}/players/${encodeURIComponent(name)}/photo`,
        {
          method: 'PUT',
          headers: { 'Content-Type': 'image/png' },
          body: TINY_PNG,
        },
      )
      expect(upRes.ok).toBe(true)

      const delRes = await fetch(
        `${CONTRACT_BASE}/players/${encodeURIComponent(name)}/photo`,
        { method: 'DELETE' },
      )
      expect(delRes.ok).toBe(true)

      const getRes = await fetch(
        `${CONTRACT_BASE}/players/${encodeURIComponent(name)}/photo`,
      )
      expect(getRes.status).toBe(404)

      // Re-deleting an already-deleted photo is also 404.
      const reDel = await fetch(
        `${CONTRACT_BASE}/players/${encodeURIComponent(name)}/photo`,
        { method: 'DELETE' },
      )
      expect(reDel.status).toBe(404)
    } finally {
      await deletePlayer(name)
    }
  })
})
