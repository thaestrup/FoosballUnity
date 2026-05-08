export const nowDbTimestamp = (): string => {
  const d = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

// The backend returns timestamps without a timezone marker (e.g.
// "2026-05-06 17:32:43.0"). Empirically these are stored ~2h behind real UTC
// (see FINDINGS.md — known backend bug). Interpreting them as UTC is the
// least-wrong option until the backend is fixed; parsing as local would
// double the offset on hosts in TZ != UTC.
export const parseDbTimestamp = (raw: string): number => {
  const cleaned = raw.replace(' ', 'T').replace(/\.0+$/, '')
  const ms = new Date(cleaned + 'Z').getTime()
  return Number.isNaN(ms) ? 0 : ms
}

export const formatDbTimestamp = (raw: string): string => {
  const ms = parseDbTimestamp(raw)
  if (ms === 0) return raw
  return new Date(ms).toLocaleString()
}

export const formatDbTimestampShort = (raw: string): string => {
  const ms = parseDbTimestamp(raw)
  if (ms === 0) return raw
  return new Date(ms).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
