import { describe, expect, it } from 'vitest'
import { makePlayer } from '@/test/factories'
import {
  LastPlayedSchema,
  PlayerListSchema,
  PlayerSchema,
} from './player'

describe('PlayerSchema', () => {
  it('parses a canonical player payload', () => {
    const player = makePlayer({ name: 'Lars', playerReady: true })
    const parsed = PlayerSchema.parse(player)
    expect(parsed).toEqual(player)
  })

  it('rejects a missing required field', () => {
    expect(() =>
      PlayerSchema.parse({
        name: 'Lars',
        playerReady: true,
        oprettet: '2026-01-01 12:00:00.0',
        // registeredRFIDTag missing
      }),
    ).toThrow()
  })

  it('rejects when playerReady is not a boolean', () => {
    expect(() =>
      PlayerSchema.parse({
        name: 'Lars',
        playerReady: 'yes',
        oprettet: '2026-01-01 12:00:00.0',
        registeredRFIDTag: '',
      }),
    ).toThrow()
  })

  it('rejects when name is not a string', () => {
    expect(() =>
      PlayerSchema.parse({
        name: 42,
        playerReady: true,
        oprettet: '2026-01-01 12:00:00.0',
        registeredRFIDTag: '',
      }),
    ).toThrow()
  })
})

describe('PlayerListSchema', () => {
  it('parses an array of players', () => {
    const list = [makePlayer({ name: 'A' }), makePlayer({ name: 'B' })]
    const parsed = PlayerListSchema.parse(list)
    expect(parsed).toHaveLength(2)
    expect(parsed[0].name).toBe('A')
  })

  it('parses an empty array', () => {
    expect(PlayerListSchema.parse([])).toEqual([])
  })

  it('rejects non-array input', () => {
    expect(() => PlayerListSchema.parse({})).toThrow()
  })
})

describe('LastPlayedSchema', () => {
  it('parses a record of name → epoch ms', () => {
    const parsed = LastPlayedSchema.parse({
      Lars: 1714600000000,
      Joan: 1714500000000,
    })
    expect(parsed.Lars).toBe(1714600000000)
  })

  it('parses an empty record', () => {
    expect(LastPlayedSchema.parse({})).toEqual({})
  })

  it('rejects non-numeric values', () => {
    expect(() =>
      LastPlayedSchema.parse({ Lars: 'recently' }),
    ).toThrow()
  })
})

