import { z } from 'zod'

export const RankingItemSchema = z.object({
  position: z.number(),
  points: z.number(),
  numberOfGames: z.number(),
  name: z.string(),
})

export const RankingListSchema = z.array(RankingItemSchema)

export type RankingItem = z.infer<typeof RankingItemSchema>

// Rankings use the same period filter as games. Aliased through `@/lib/period`
// so the rankings-specific names keep working at call sites that prefer them.
export type { Period as RankingPeriod } from '@/lib/period'
