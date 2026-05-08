import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { TimerActionListSchema, type TimerAction } from './timer'

export const timerQuery = queryOptions({
  queryKey: ['timer'],
  queryFn: async () => {
    const data = await api<unknown>('/timer')
    const list = TimerActionListSchema.parse(data)
    return list[0] as TimerAction | undefined
  },
})

export const useTimer = () => {
  return useQuery({
    ...timerQuery,
    refetchInterval: 1000,
    refetchIntervalInBackground: false,
  })
}

export const useResetTimer = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api('/timer', { method: 'POST' }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: timerQuery.queryKey })
    },
  })
}
