import { describe, expect, it } from 'vitest'
import { ConfigurationListSchema } from '@/features/configuration/configuration'
import {
  CONTRACT_BASE,
  shouldRunContract,
  useLiveBackend,
} from './contractEnv'

describe.skipIf(!shouldRunContract)('contract: configuration', () => {
  useLiveBackend()

  it('GET /configuration/ matches ConfigurationListSchema', async () => {
    const res = await fetch(`${CONTRACT_BASE}/configuration/`)
    expect(res.ok).toBe(true)
    const data: unknown = await res.json()
    const parsed = ConfigurationListSchema.parse(data)
    expect(Array.isArray(parsed)).toBe(true)
    // Sanity: every config entry has both name and value as strings.
    for (const item of parsed) {
      expect(typeof item.name).toBe('string')
      expect(typeof item.value).toBe('string')
    }
  })
})
