import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  formatDbTimestamp,
  formatDbTimestampShort,
  nowDbTimestamp,
  parseDbTimestamp,
} from './time'

describe('parseDbTimestamp', () => {
  it('parses the backend format with trailing .0', () => {
    const ms = parseDbTimestamp('2026-05-01 12:00:00.0')
    // Treated as UTC per the workaround in time.ts.
    expect(ms).toBe(Date.UTC(2026, 4, 1, 12, 0, 0))
  })

  it('returns 0 for unparseable input', () => {
    expect(parseDbTimestamp('not a timestamp')).toBe(0)
  })

  it('handles timestamps without fractional seconds', () => {
    const ms = parseDbTimestamp('2026-05-01 12:00:00')
    expect(ms).toBe(Date.UTC(2026, 4, 1, 12, 0, 0))
  })
})

describe('formatDbTimestamp', () => {
  it('returns a locale string for parseable input', () => {
    const out = formatDbTimestamp('2026-05-01 12:00:00.0')
    // Output is locale-dependent; assert it's not the raw input and contains
    // some recognisable parts.
    expect(out).not.toBe('2026-05-01 12:00:00.0')
    expect(out.length).toBeGreaterThan(0)
  })

  it('returns the raw value when unparseable', () => {
    expect(formatDbTimestamp('garbage')).toBe('garbage')
  })
})

describe('formatDbTimestampShort', () => {
  it('produces a compact representation', () => {
    const out = formatDbTimestampShort('2026-05-01 12:00:00.0')
    expect(out.length).toBeGreaterThan(0)
    expect(out).not.toContain('2026-05-01 12:00:00')
  })
})

describe('nowDbTimestamp', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('matches the YYYY-MM-DD HH:mm:ss format', () => {
    const out = nowDbTimestamp()
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/)
  })

  it('has the expected length of 19 characters', () => {
    expect(nowDbTimestamp()).toHaveLength(19)
  })

  it('renders all components zero-padded for a fixed date', () => {
    // March 7, 2026 at 03:04:05 local time. Pick local-time components so
    // the test passes regardless of host TZ.
    const fixed = new Date(2026, 2, 7, 3, 4, 5)
    vi.setSystemTime(fixed)
    expect(nowDbTimestamp()).toBe('2026-03-07 03:04:05')
  })

  it('uses local time components (not UTC)', () => {
    // Build a timestamp at local noon so we can compare directly.
    const fixed = new Date(2026, 5, 15, 12, 30, 45)
    vi.setSystemTime(fixed)
    const out = nowDbTimestamp()
    expect(out).toBe('2026-06-15 12:30:45')
  })
})
