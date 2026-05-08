import { describe, expect, it } from 'vitest'
import { makeConfiguration } from '@/test/factories'
import {
  ConfigurationItemSchema,
  ConfigurationListSchema,
  getConfigValue,
  getNumberOfTables,
  getTableNames,
} from './configuration'

describe('ConfigurationItemSchema', () => {
  it('parses a canonical item', () => {
    expect(
      ConfigurationItemSchema.parse({ name: 'numberOfTables', value: '3' }),
    ).toEqual({ name: 'numberOfTables', value: '3' })
  })

  it('rejects a numeric value (backend always serialises as string)', () => {
    expect(() =>
      ConfigurationItemSchema.parse({ name: 'numberOfTables', value: 3 }),
    ).toThrow()
  })

  it('rejects a missing name', () => {
    expect(() => ConfigurationItemSchema.parse({ value: 'x' })).toThrow()
  })
})

describe('ConfigurationListSchema', () => {
  it('parses the default factory configuration', () => {
    const items = makeConfiguration()
    const parsed = ConfigurationListSchema.parse(items)
    expect(parsed).toHaveLength(items.length)
  })

  it('parses an empty list', () => {
    expect(ConfigurationListSchema.parse([])).toEqual([])
  })
})

describe('getConfigValue', () => {
  const items = makeConfiguration()

  it('returns the value for a known name', () => {
    expect(getConfigValue(items, 'numberOfTables')).toBe('3')
    expect(getConfigValue(items, 'nameTable1')).toBe('Fort Nordjylland')
  })

  it('returns undefined for an unknown name', () => {
    expect(getConfigValue(items, 'nope')).toBeUndefined()
  })

  it('returns undefined when items is empty', () => {
    expect(getConfigValue([], 'numberOfTables')).toBeUndefined()
  })
})

describe('getNumberOfTables', () => {
  it('returns the parsed value when present', () => {
    expect(getNumberOfTables(makeConfiguration())).toBe(3)
  })

  it('defaults to 1 when items is undefined', () => {
    expect(getNumberOfTables(undefined)).toBe(1)
  })

  it('defaults to 1 when the config key is missing', () => {
    expect(getNumberOfTables([])).toBe(1)
  })

  it('defaults to 1 when value is non-numeric', () => {
    expect(
      getNumberOfTables([{ name: 'numberOfTables', value: 'banana' }]),
    ).toBe(1)
  })

  it('defaults to 1 when value is zero or negative', () => {
    expect(getNumberOfTables([{ name: 'numberOfTables', value: '0' }])).toBe(1)
    expect(getNumberOfTables([{ name: 'numberOfTables', value: '-2' }])).toBe(1)
  })

  it('parses a leading-numeric string (parseInt semantics)', () => {
    expect(getNumberOfTables([{ name: 'numberOfTables', value: '4 tables' }])).toBe(4)
  })
})

describe('getTableNames', () => {
  it('returns the configured table names in order', () => {
    expect(getTableNames(makeConfiguration())).toEqual([
      'Fort Nordjylland',
      'John og Nikolaj Stadion',
      'Henrik Park',
    ])
  })

  it('returns an empty array when items is undefined', () => {
    expect(getTableNames(undefined)).toEqual([])
  })

  it('returns an empty array when no nameTableN keys exist', () => {
    expect(getTableNames([{ name: 'numberOfTables', value: '3' }])).toEqual([])
  })

  it('skips missing entries up to numberOfTables', () => {
    // 3 tables advertised but only the second one named.
    expect(
      getTableNames([
        { name: 'numberOfTables', value: '3' },
        { name: 'nameTable2', value: 'Middle' },
      ]),
    ).toEqual(['Middle'])
  })

  it('respects numberOfTables=1 default and only emits nameTable1', () => {
    expect(
      getTableNames([
        { name: 'nameTable1', value: 'Solo' },
        { name: 'nameTable2', value: 'Ignored' },
      ]),
    ).toEqual(['Solo'])
  })
})
