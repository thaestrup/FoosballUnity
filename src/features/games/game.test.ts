import { describe, expect, it } from 'vitest'
import { makeGame } from '@/test/factories'
import { GameListSchema, GameSchema, winnerSide } from './game'

describe('GameSchema', () => {
  it('parses a canonical game payload', () => {
    const game = makeGame()
    expect(GameSchema.parse(game)).toEqual(game)
  })

  it('parses a game with all four player slots populated', () => {
    const game = makeGame({
      player_red_1: 'Lars',
      player_red_2: 'Joan',
      player_blue_1: 'Frank',
      player_blue_2: 'Daniel',
    })
    const parsed = GameSchema.parse(game)
    expect(parsed.player_red_1).toBe('Lars')
    expect(parsed.player_blue_2).toBe('Daniel')
  })

  describe('"null" → null transform', () => {
    it('converts the literal string "null" to JS null on player_red_1', () => {
      const game = makeGame({ player_red_1: 'null' as unknown as string })
      const parsed = GameSchema.parse(game)
      expect(parsed.player_red_1).toBeNull()
    })

    it('converts "null" to null on player_red_2', () => {
      const game = makeGame({ player_red_2: 'null' as unknown as string })
      expect(GameSchema.parse(game).player_red_2).toBeNull()
    })

    it('converts "null" to null on player_blue_1', () => {
      const game = makeGame({ player_blue_1: 'null' as unknown as string })
      expect(GameSchema.parse(game).player_blue_1).toBeNull()
    })

    it('converts "null" to null on player_blue_2', () => {
      const game = makeGame({ player_blue_2: 'null' as unknown as string })
      expect(GameSchema.parse(game).player_blue_2).toBeNull()
    })

    it('converts empty string to null', () => {
      const game = makeGame({ player_red_1: '' })
      expect(GameSchema.parse(game).player_red_1).toBeNull()
    })

    it('passes JS null through untouched', () => {
      const game = makeGame({ player_red_1: null as unknown as string })
      expect(GameSchema.parse(game).player_red_1).toBeNull()
    })

    it('does not transform non-"null" names that contain the substring', () => {
      const game = makeGame({ player_red_1: 'nullable' })
      expect(GameSchema.parse(game).player_red_1).toBe('nullable')
    })
  })

  it('rejects when id is missing', () => {
    const { id: _id, ...game } = makeGame()
    expect(() => GameSchema.parse(game)).toThrow()
  })

  it('rejects when winning_table is a string', () => {
    expect(() =>
      GameSchema.parse({ ...makeGame(), winning_table: '1' }),
    ).toThrow()
  })

  it('rejects when match_winner is missing', () => {
    const { match_winner: _w, ...game } = makeGame()
    expect(() => GameSchema.parse(game)).toThrow()
  })
})

describe('GameListSchema', () => {
  it('parses a list of games', () => {
    const list = [makeGame(), makeGame()]
    expect(GameListSchema.parse(list)).toHaveLength(2)
  })

  it('parses an empty list', () => {
    expect(GameListSchema.parse([])).toEqual([])
  })
})

describe('winnerSide', () => {
  it('detects "red"', () => {
    expect(winnerSide('red')).toBe('red')
  })

  it('detects "Red" (case-insensitive)', () => {
    expect(winnerSide('Red')).toBe('red')
  })

  it('detects substrings like "red wins"', () => {
    expect(winnerSide('red wins')).toBe('red')
  })

  it('detects Danish "rød"', () => {
    expect(winnerSide('rød')).toBe('red')
  })

  it('detects "RØD" capitalised', () => {
    expect(winnerSide('RØD')).toBe('red')
  })

  it('detects "blue"', () => {
    expect(winnerSide('blue')).toBe('blue')
  })

  it('detects Danish "blå"', () => {
    expect(winnerSide('blå')).toBe('blue')
  })

  it('detects "Blå" capitalised', () => {
    expect(winnerSide('Blå')).toBe('blue')
  })

  it('detects "tie"', () => {
    expect(winnerSide('tie')).toBe('tie')
  })

  it('detects "draw"', () => {
    expect(winnerSide('draw')).toBe('tie')
  })

  it('detects Danish "uafgjort"', () => {
    expect(winnerSide('uafgjort')).toBe('tie')
  })

  it('returns "unknown" for empty string', () => {
    expect(winnerSide('')).toBe('unknown')
  })

  it('returns "unknown" for unknown values', () => {
    expect(winnerSide('purple')).toBe('unknown')
  })
})
