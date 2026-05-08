import { queryOptions, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { RankingListSchema, type RankingPeriod } from './ranking'

export const rankingsQuery = (period: RankingPeriod) =>
  queryOptions({
    queryKey: ['rankings', period],
    queryFn: async () => {
      const data = await api<unknown>(`/pointsPrPlayer/${period}`)
      return RankingListSchema.parse(data)
    },
  })

export const useRankings = (period: RankingPeriod) => {
  return useQuery(rankingsQuery(period))
}
