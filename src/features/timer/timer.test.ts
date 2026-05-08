import { describe, expect, it } from 'vitest'
import { makeTimer } from '@/test/factories'
import { formatMmSs, TimerActionListSchema, TimerActionSchema } from './timer'

describe('TimerActionSchema', () => {
  it('parses a canonical timer action', () => {
    const t = makeTimer()
    expect(TimerActionSchema.parse(t)).toEqual(t)
  })

  it('rejects when id is a string', () => {
    expect(() =>
      TimerActionSchema.parse({
        id: '1',
        lastRequestedTimerStart: '2026-05-01 12:00:00.0',
      }),
    ).toThrow()
  })

  it('rejects missing lastRequestedTimerStart', () => {
    expect(() => TimerActionSchema.parse({ id: 1 })).toThrow()
  })
})

describe('TimerActionListSchema', () => {
  it('parses an array of timer actions', () => {
    expect(TimerActionListSchema.parse([makeTimer(), makeTimer()])).toHaveLength(2)
  })

  it('parses an empty array', () => {
    expect(TimerActionListSchema.parse([])).toEqual([])
  })
})

describe('formatMmSs', () => {
  it('formats positive seconds as M:SS', () => {
    expect(formatMmSs(65)).toBe('1:05')
  })

  it('zero-pads the seconds component', () => {
    expect(formatMmSs(60)).toBe('1:00')
    expect(formatMmSs(125)).toBe('2:05')
  })

  it('formats zero as 0:00', () => {
    expect(formatMmSs(0)).toBe('0:00')
  })

  it('formats sub-minute values', () => {
    expect(formatMmSs(7)).toBe('0:07')
    expect(formatMmSs(45)).toBe('0:45')
  })

  it('formats negative values with a leading "-"', () => {
    expect(formatMmSs(-65)).toBe('-1:05')
  })

  it('formats -1 as -0:01', () => {
    expect(formatMmSs(-1)).toBe('-0:01')
  })

  it('floors fractional values', () => {
    expect(formatMmSs(65.9)).toBe('1:05')
  })

  it('handles large values (no hour rollover)', () => {
    // 1 hour = 60 min = "60:00" — function intentionally only handles MM:SS
    expect(formatMmSs(3600)).toBe('60:00')
    expect(formatMmSs(3661)).toBe('61:01')
  })

  it('treats sub-second negatives as 0:00', () => {
    expect(formatMmSs(-0.5)).toBe('0:00')
  })
})
