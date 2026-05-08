// Shared period filter type used by games / rankings / player detail.
// All five values map directly to backend `/games/{period}` and
// `/pointsPrPlayer/{period}` segments.

export type Period = 'hour' | 'day' | 'week' | 'month' | 'alltime'

export const PERIODS: Period[] = ['hour', 'day', 'week', 'month', 'alltime']

export const PERIOD_LABELS: Record<Period, string> = {
  hour: 'Last hour',
  day: 'Today',
  week: 'This week',
  month: 'This month',
  alltime: 'All time',
}

export const PERIOD_LABELS_SHORT: Record<Period, string> = {
  hour: 'Hr',
  day: 'Day',
  week: 'Wk',
  month: 'Mo',
  alltime: 'All',
}

// Used by PlayerDetail to filter games into a period before charting; null
// means "no time bound" (alltime).
export const PERIOD_HOURS: Record<Period, number | null> = {
  hour: 1,
  day: 24,
  week: 24 * 7,
  month: 24 * 30,
  alltime: null,
}
