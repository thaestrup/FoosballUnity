import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { useGamesByPlayer } from '@/features/games/useGames'
import { winnerSide, type Game } from '@/features/games/game'
import {
  formatDbTimestamp,
  formatDbTimestampShort,
  parseDbTimestamp,
} from '@/lib/time'
import { Avatar } from '@/components/Avatar'
import { PeriodTabs } from '@/components/PeriodTabs'
import { ErrorNotice } from '@/components/ErrorNotice'
import { PERIOD_HOURS, type Period } from '@/lib/period'
import styles from './PlayerDetail.module.css'

const STARTING_POINTS = 1500

type Props = { name: string }

export const PlayerDetail = ({ name }: Props) => {
  const { data: games, isPending, error, refetch } = useGamesByPlayer(name)

  const stats = useMemo(() => computeStats(name, games ?? []), [name, games])

  return (
    <article className={styles.wrapper}>
      <header className={styles.header}>
        <Avatar name={name} className={styles.avatar} />
        <div className={styles.titleBlock}>
          <h2 className={styles.name}>{name}</h2>
          <Link to="/players" className={styles.backLink}>
            ← All players
          </Link>
        </div>
      </header>

      <div className={styles.stats}>
        <Stat value={stats.total} label="games" />
        <Stat value={stats.wins} label="won" tone="win" />
        <Stat value={stats.losses} label="lost" tone="loss" />
        <Stat value={stats.draws} label="drew" tone="tie" />
        <Stat value={`${Math.round(stats.winRate * 100)}%`} label="win rate" />
      </div>

      {games && games.length > 0 && (
        <PointsOverTime name={name} games={games} />
      )}

      <h3 className={styles.subhead}>Recent games</h3>

      {isPending && <p className={styles.muted}>Loading…</p>}
      {error && (
        <ErrorNotice what="games" error={error} onRetry={() => void refetch()} />
      )}
      {games && games.length === 0 && (
        <p className={styles.muted}>No games recorded for {name}.</p>
      )}
      {games && games.length > 0 && (
        <ol className={styles.gamesList}>
          {games.map((g) => (
            <li key={g.id}>
              <PlayerGameRow game={g} player={name} />
            </li>
          ))}
        </ol>
      )}
    </article>
  )
}

const PointsOverTime = ({ name, games }: { name: string; games: Game[] }) => {
  const [period, setPeriod] = useState<Period>('alltime')

  const series = useMemo(() => buildPointsSeries(name, games), [name, games])
  const filtered = useMemo(() => filterByPeriod(series, period), [series, period])

  const min = Math.min(...filtered.map((p) => p.points), STARTING_POINTS)
  const max = Math.max(...filtered.map((p) => p.points), STARTING_POINTS)
  // Pad y-axis a bit so the line isn't pinned to the edges.
  const yMin = Math.floor(min - 25)
  const yMax = Math.ceil(max + 25)

  return (
    <section className={styles.chartSection}>
      <header className={styles.chartHead}>
        <h3 className={styles.subhead}>Points over time</h3>
        <PeriodTabs value={period} onChange={setPeriod} />
      </header>

      {filtered.length === 0 ? (
        <p className={styles.muted}>No games in this period.</p>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={filtered} margin={{ top: 8, right: 16, bottom: 8, left: 8 }}>
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
              y={STARTING_POINTS}
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
              labelFormatter={(label) => label}
              formatter={(value: number) => [value, 'points']}
              cursor={{ stroke: 'var(--border-strong)' }}
            />
            <Line
              type="monotone"
              dataKey="points"
              stroke="var(--accent)"
              strokeWidth={2}
              dot={{ fill: 'var(--accent)', r: 3 }}
              activeDot={{ r: 5 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </section>
  )
}

const buildPointsSeries = (name: string, games: Game[]) => {
  const sorted = [...games].sort(
    (a, b) =>
      parseDbTimestamp(a.lastUpdated) - parseDbTimestamp(b.lastUpdated),
  )
  const series: Array<{ x: string; ts: number; points: number; gameId: number | 'start' }> = []
  let running = STARTING_POINTS
  series.push({
    x: 'Start',
    ts: sorted.length ? parseDbTimestamp(sorted[0].lastUpdated) - 1 : 0,
    points: running,
    gameId: 'start',
  })
  for (const g of sorted) {
    running += pointsDelta(g, name)
    series.push({
      x: formatDbTimestampShort(g.lastUpdated),
      ts: parseDbTimestamp(g.lastUpdated),
      points: running,
      gameId: g.id,
    })
  }
  return series
}

const filterByPeriod = (
  series: ReturnType<typeof buildPointsSeries>,
  period: Period,
) => {
  const hours = PERIOD_HOURS[period]
  if (hours == null) return series
  const cutoff = Date.now() - hours * 3600 * 1000
  return series.filter((p) => p.ts >= cutoff)
}

const pointsDelta = (g: Game, name: string): number => {
  const onRed = g.player_red_1 === name || g.player_red_2 === name
  const winner = winnerSide(g.match_winner)
  if (winner === 'tie') return g.points_at_stake
  if (winner === 'unknown') return 0
  const won = (onRed && winner === 'red') || (!onRed && winner === 'blue')
  return won ? g.points_at_stake : -g.points_at_stake
}

const Stat = ({
  value,
  label,
  tone,
}: {
  value: number | string
  label: string
  tone?: 'win' | 'loss' | 'tie'
}) => {
  return (
    <div className={`${styles.statCard} ${tone ? styles[`tone_${tone}`] : ''}`}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
    </div>
  )
}

const PlayerGameRow = ({ game, player }: { game: Game; player: string }) => {
  const onRed = game.player_red_1 === player || game.player_red_2 === player
  const winner = winnerSide(game.match_winner)

  let outcome: 'win' | 'loss' | 'tie' | 'unknown' = 'unknown'
  if (winner === 'tie') outcome = 'tie'
  else if (winner === 'unknown') outcome = 'unknown'
  else if ((onRed && winner === 'red') || (!onRed && winner === 'blue')) outcome = 'win'
  else outcome = 'loss'

  const partner = onRed
    ? game.player_red_1 === player
      ? game.player_red_2
      : game.player_red_1
    : game.player_blue_1 === player
      ? game.player_blue_2
      : game.player_blue_1
  const opponents = (
    onRed
      ? [game.player_blue_1, game.player_blue_2]
      : [game.player_red_1, game.player_red_2]
  ).filter((n): n is string => n != null)

  return (
    <article className={`${styles.gameRow} ${styles[`row_${outcome}`]}`}>
      <span className={styles.gameId}>#{game.id}</span>
      <time className={styles.gameTime}>{formatDbTimestamp(game.lastUpdated)}</time>
      <span className={styles.partner}>{partner ? `w/ ${partner}` : 'solo'}</span>
      <span className={styles.opponents}>
        vs {opponents.length > 0 ? opponents.join(' & ') : '—'}
      </span>
      <span className={styles.outcome}>{outcomeLabel(outcome)}</span>
      <span className={styles.gamePoints}>{game.points_at_stake} pts</span>
    </article>
  )
}

const outcomeLabel = (o: 'win' | 'loss' | 'tie' | 'unknown') => {
  return o === 'win' ? 'Won' : o === 'loss' ? 'Lost' : o === 'tie' ? 'Tie' : '—'
}

const computeStats = (name: string, games: Game[]) => {
  let wins = 0
  let losses = 0
  let draws = 0
  for (const g of games) {
    const onRed = g.player_red_1 === name || g.player_red_2 === name
    const winner = winnerSide(g.match_winner)
    if (winner === 'tie') {
      draws++
    } else if (winner === 'unknown') {
      // skip — can't classify
    } else if ((onRed && winner === 'red') || (!onRed && winner === 'blue')) {
      wins++
    } else {
      losses++
    }
  }
  const total = games.length
  return { wins, losses, draws, total, winRate: total ? wins / total : 0 }
}
