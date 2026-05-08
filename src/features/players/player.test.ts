import { describe, expect, it } from 'vitest'
import { makePlayer } from '@/test/factories'
import { avatarUrl, FALLBACK_AVATAR } from '@/lib/avatar'
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

describe('avatarUrl', () => {
  it('lowercases the name', () => {
    expect(avatarUrl('Lars')).toBe('/img/lars.jpg')
  })

  it('replaces spaces with dashes', () => {
    expect(avatarUrl('John Doe')).toBe('/img/john-doe.jpg')
  })

  it('collapses runs of whitespace', () => {
    expect(avatarUrl('John   Foo  Bar')).toBe('/img/john-foo-bar.jpg')
  })

  it('handles tabs and newlines as whitespace', () => {
    expect(avatarUrl('John\tDoe')).toBe('/img/john-doe.jpg')
  })

  it('lowercases mixed case names', () => {
    expect(avatarUrl('JOHN DOE')).toBe('/img/john-doe.jpg')
  })

  it('returns a path even for empty input', () => {
    expect(avatarUrl('')).toBe('/img/.jpg')
  })

  it('exports the fallback avatar constant', () => {
    expect(FALLBACK_AVATAR).toBe('/img/Wildcard.jpg')
  })
})
