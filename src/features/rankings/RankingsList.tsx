import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useRankings } from './useRankings'
import { type RankingItem } from './ranking'
import { PERIOD_HOURS, type Period } from '@/lib/period'
import { usePlayers } from '@/features/players/usePlayers'
import { useGames } from '@/features/games/useGames'
import { winnerSide, type Game } from '@/features/games/game'
import { formatDbTimestampShort, parseDbTimestamp } from '@/lib/time'
import { Avatar } from '@/components/Avatar'
import { PeriodTabs } from '@/components/PeriodTabs'
import { ErrorNotice } from '@/components/ErrorNotice'
import styles from './RankingsList.module.css'

const STARTING_POINTS = 1500

type SeriesRow = { x: string; ts: number } & Record<string, number | string>

export const RankingsList = () => {
  const [period, setPeriod] = useState<Period>('alltime')
  const { data: rankings, isPending, error, refetch } = useRankings(period)
  const { data: players } = usePlayers()
  const { data: games } = useGames('alltime')

  const sorted = useMemo(() => {
    if (!rankings) return []
    return [...rankings].sort((a, b) => {
      if (a.position !== b.position) return a.position - b.position
      if (b.points !== a.points) return b.points - a.points
      return a.name.localeCompare(b.name)
    })
  }, [rankings])

  const readyNames = useMemo(
    () =>
      (players ?? [])
        .filter((p) => p.playerReady)
        .map((p) => p.name)
        .sort((a, b) => a.localeCompare(b)),
    [players],
  )

  const series = useMemo(
    () => buildMultiPlayerSeries(games ?? [], readyNames),
    [games, readyNames],
  )
  // "All time" keeps the absolute Elo so the chart matches the points column
  // in the ranking list below; shorter windows show how players moved during
  // that window only, so the y-axis stays useful at small ranges.
  const relative = period !== 'alltime'
  const filtered = useMemo(() => {
    const inWindow = filterByPeriod(series, period)
    return relative ? toRelative(inWindow, readyNames) : inWindow
  }, [series, period, readyNames, relative])

  return (
    <div className={styles.wrapper}>
      <PeriodTabs value={period} onChange={setPeriod} />

      {isPending && <p className={styles.muted}>Loading rankings…</p>}
      {error && (
        <ErrorNotice what="rankings" error={error} onRetry={() => void refetch()} />
      )}
      {rankings && rankings.length === 0 && (
        <p className={styles.muted}>
          No ranked players in this period. Played games will appear here.
        </p>
      )}

      {readyNames.length > 0 && filtered.length > 0 && (
        <ReadyPlayersChart
          names={readyNames}
          data={filtered}
          relative={relative}
        />
      )}
      {readyNames.length === 0 && rankings && rankings.length > 0 && (
        <p className={styles.muted}>
          Select players on the Players page to see their points over time.
        </p>
      )}

      {sorted.length > 0 && (
        <ol className={styles.list}>
          {sorted.map((r) => (
            <li key={r.name}>
              <RankRow item={r} />
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

const ReadyPlayersChart = ({
  names,
  data,
  relative,
}: {
  names: string[]
  data: SeriesRow[]
  relative: boolean
}) => {
  const [hovered, setHovered] = useState<string | null>(null)

  const baseline = relative ? 0 : STARTING_POINTS
  const allValues = data.flatMap((d) =>
    names.map((n) => Number(d[n] ?? baseline)),
  )
  const min = Math.min(baseline, ...allValues)
  const max = Math.max(baseline, ...allValues)
  const yMin = Math.floor(min) - 25
  const yMax = Math.ceil(max) + 25

  return (
    <section className={styles.chartWrap}>
      <h3 className={styles.chartTitle}>
        Points over time — {names.length} ready player
        {names.length === 1 ? '' : 's'}
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart
          data={data}
          margin={{ top: 8, right: 16, bottom: 8, left: 8 }}
        >
          <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" />
          <XAxis
            dataKey="x"
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            stroke="var(--border)"
          />
          <YAxis
            domain={[yMin, yMax]}
            tick={{ fill: 'var(--text-muted)', fontSize: 12 }}
            stroke="var(--border)"
            width={48}
          />
          <ReferenceLine
            y={baseline}
            stroke="var(--border-strong)"
            strokeDasharray="2 2"
          />
          <Tooltip
            contentStyle={{
              background: 'var(--bg-card)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              color: 'var(--text)',
            }}
            cursor={{ stroke: 'var(--border-strong)' }}
            formatter={(value) => {
              const n = Number(value)
              if (!relative) return `${n}`
              return n > 0 ? `+${n}` : `${n}`
            }}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, cursor: 'pointer' }}
            onMouseEnter={(o) => {
              const key =
                typeof o?.dataKey === 'string'
                  ? o.dataKey
                  : typeof o?.value === 'string'
                    ? o.value
                    : null
              setHovered(key)
            }}
            onMouseLeave={() => setHovered(null)}
          />
          {names.map((name, i) => {
            const dim = hovered != null && hovered !== name
            return (
              <Line
                key={name}
                type="monotone"
                dataKey={name}
                stroke={colorFor(i)}
                strokeWidth={hovered === name ? 3 : 2}
                strokeOpacity={dim ? 0.15 : 1}
                dot={false}
                activeDot={{ r: 4 }}
                isAnimationActive={false}
              />
            )
          })}
        </LineChart>
      </ResponsiveContainer>
    </section>
  )
}

// Golden-angle hue spacing keeps adjacent player lines visually distinct
// without having to hand-tune a palette of N+ colors.
const colorFor = (i: number): string => {
  const hue = (i * 137.508) % 360
  return `hsl(${hue}, 65%, 50%)`
}

const buildMultiPlayerSeries = (games: Game[], names: string[]): SeriesRow[] => {
  if (names.length === 0) return []
  const sorted = [...games].sort(
    (a, b) =>
      parseDbTimestamp(a.lastUpdated) - parseDbTimestamp(b.lastUpdated),
  )
  const points: Record<string, number> = Object.fromEntries(
    names.map((n) => [n, STARTING_POINTS]),
  )
  const series: SeriesRow[] = []
  series.push({
    x: 'Start',
    ts: sorted.length ? parseDbTimestamp(sorted[0].lastUpdated) - 1 : 0,
    ...points,
  })
  for (const g of sorted) {
    let touched = false
    for (const name of names) {
      if (!isPlayerInGame(g, name)) continue
      points[name] += pointsDelta(g, name)
      touched = true
    }
    if (!touched) continue
    series.push({
      x: formatDbTimestampShort(g.lastUpdated),
      ts: parseDbTimestamp(g.lastUpdated),
      ...points,
    })
  }
  return series
}

// Subtract each player's first-row value from the rest of the series so the
// chart shows points *change* across the selected period, with a 0 baseline
// instead of absolute Elo. The y-axis then auto-scales to whatever range the
// players actually moved through, including negative deltas.
const toRelative = (series: SeriesRow[], names: string[]): SeriesRow[] => {
  if (series.length === 0) return series
  const baseline = series[0]
  return series.map((r) => {
    const out: SeriesRow = { x: r.x, ts: r.ts }
    for (const n of names) {
      out[n] = Number(r[n] ?? 0) - Number(baseline[n] ?? 0)
    }
    return out
  })
}

// Prepend a synthetic "period start" row carrying the latest pre-cutoff
// values so each line has a baseline at the period edge instead of starting
// mid-air at the first in-window game.
const filterByPeriod = (
  series: SeriesRow[],
  period: Period,
): SeriesRow[] => {
  const hours = PERIOD_HOURS[period]
  if (hours == null) return series
  const cutoff = Date.now() - hours * 3600 * 1000
  let lastBefore: SeriesRow | null = null
  const after: SeriesRow[] = []
  for (const r of series) {
    if (r.ts < cutoff) lastBefore = r
    else after.push(r)
  }
  if (after.length === 0) return []
  if (lastBefore) {
    return [{ ...lastBefore, x: 'Start', ts: cutoff }, ...after]
  }
  return after
}

const isPlayerInGame = (g: Game, name: string): boolean => {
  return (
    g.player_red_1 === name ||
    g.player_red_2 === name ||
    g.player_blue_1 === name ||
    g.player_blue_2 === name
  )
}

const pointsDelta = (g: Game, name: string): number => {
  const onRed = g.player_red_1 === name || g.player_red_2 === name
  const winner = winnerSide(g.match_winner)
  if (winner === 'tie') return g.points_at_stake
  if (winner === 'unknown') return 0
  const won = (onRed && winner === 'red') || (!onRed && winner === 'blue')
  return won ? g.points_at_stake : -g.points_at_stake
}

const RankRow = ({ item }: { item: RankingItem }) => {
  return (
    <Link
      to="/player/$name"
      params={{ name: item.name }}
      className={styles.row}
    >
      <span className={`${styles.position} ${positionClass(item.position)}`}>
        {item.position}
      </span>
      <Avatar name={item.name} className={styles.avatar} />
      <span className={styles.name}>{item.name}</span>
      <span className={styles.points}>{item.points}</span>
      <span className={styles.games}>
        {item.numberOfGames} game{item.numberOfGames === 1 ? '' : 's'}
      </span>
    </Link>
  )
}

const positionClass = (pos: number): string => {
  if (pos === 1) return styles.gold
  if (pos === 2) return styles.silver
  if (pos === 3) return styles.bronze
  return ''
}
