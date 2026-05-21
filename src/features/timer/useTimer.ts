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

// Subscribes to the timer query cache. Updates are driven by
// useTimerSocket() (mounted once at the root) — via WebSocket push in the
// happy path, or 1 Hz polling as a fallback. Consumers re-render whenever
// the cache changes, regardless of which transport delivered the update.
export const useTimer = () => {
  return useQuery(timerQuery)
}

export const useResetTimer = () => {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => api('/timer', { method: 'POST' }),
    onSuccess: () => {
      // The backend also broadcasts on POST so the WS path normally
      // refreshes the cache without this. Kept as a fallback in case the
      // frame is dropped (transient WS hiccup mid-reset).
      void qc.invalidateQueries({ queryKey: timerQuery.queryKey })
    },
  })
}
