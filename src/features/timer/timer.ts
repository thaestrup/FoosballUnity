import { z } from 'zod'

export const TimerActionSchema = z.object({
  id: z.number(),
  lastRequestedTimerStart: z.string(),
})

export const TimerActionListSchema = z.array(TimerActionSchema)

export type TimerAction = z.infer<typeof TimerActionSchema>

export const formatMmSs = (totalSeconds: number): string => {
  const s = Math.floor(Math.abs(totalSeconds))
  const sign = totalSeconds < 0 && s > 0 ? '-' : ''
  const m = Math.floor(s / 60)
  const sec = s % 60
  return `${sign}${m}:${String(sec).padStart(2, '0')}`
}
