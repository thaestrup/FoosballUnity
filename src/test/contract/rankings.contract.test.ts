import { describe, expect, it } from 'vitest'
import { RankingListSchema } from '@/features/rankings/ranking'
import { PERIODS as RANKING_PERIODS } from '@/lib/period'
import {
  CONTRACT_BASE,
  shouldRunContract,
  useLiveBackend,
} from './contractEnv'

describe.skipIf(!shouldRunContract)('contract: rankings', () => {
  useLiveBackend()

  // Note: the root path `/pointsPrPlayer/` returns 500. We only contract-test
  // the per-period form that the frontend actually calls.
  for (const period of RANKING_PERIODS) {
    it(`GET /pointsPrPlayer/${period} matches RankingListSchema`, async () => {
      const res = await fetch(`${CONTRACT_BASE}/pointsPrPlayer/${period}`)
      expect(res.ok).toBe(true)
      const data: unknown = await res.json()
      const parsed = RankingListSchema.parse(data)
      expect(Array.isArray(parsed)).toBe(true)
    })
  }
})
