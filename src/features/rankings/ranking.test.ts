import { describe, expect, it } from 'vitest'
import { makeRankingItem } from '@/test/factories'
import { RankingItemSchema, RankingListSchema } from './ranking'

describe('RankingItemSchema', () => {
  it('parses a canonical ranking item', () => {
    const item = makeRankingItem({ name: 'Lars', points: 1530, position: 1 })
    expect(RankingItemSchema.parse(item)).toEqual(item)
  })

  it('rejects when position is a string', () => {
    expect(() =>
      RankingItemSchema.parse({
        position: '1',
        points: 1530,
        numberOfGames: 0,
        name: 'Lars',
      }),
    ).toThrow()
  })

  it('rejects missing name', () => {
    expect(() =>
      RankingItemSchema.parse({
        position: 1,
        points: 1530,
        numberOfGames: 0,
      }),
    ).toThrow()
  })

  it('accepts zero points and zero games', () => {
    const item = makeRankingItem({ points: 0, numberOfGames: 0 })
    expect(RankingItemSchema.parse(item).points).toBe(0)
  })

  it('accepts negative points (ELO can dip below baseline)', () => {
    const item = makeRankingItem({ points: -50 })
    expect(RankingItemSchema.parse(item).points).toBe(-50)
  })
})

describe('RankingListSchema', () => {
  it('parses a list of ranking items', () => {
    const list = [
      makeRankingItem({ name: 'A', position: 1 }),
      makeRankingItem({ name: 'B', position: 2 }),
    ]
    expect(RankingListSchema.parse(list)).toHaveLength(2)
  })

  it('parses an empty list', () => {
    expect(RankingListSchema.parse([])).toEqual([])
  })

  it('rejects non-array input', () => {
    expect(() => RankingListSchema.parse({ items: [] })).toThrow()
  })
})
