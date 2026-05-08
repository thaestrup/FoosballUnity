import { Link } from '@tanstack/react-router'
import { usePlayers } from '@/features/players/usePlayers'
import { useGames } from '@/features/games/useGames'
import { useRankings } from '@/features/rankings/useRankings'
import type { RankingItem } from '@/features/rankings/ranking'
import { Avatar } from '@/components/Avatar'
import { winnerSide, type Game } from '@/features/games/game'
import styles from './Dashboard.module.css'

const RECENT_GAMES_LIMIT = 4
const TOP_PLAYERS_LIMIT = 3

export const Dashboard = () => {
  const { data: players } = usePlayers()
  const { data: weekGames } = useGames('week')
  const { data: dayGames } = useGames('day')
  const { data: rankings } = useRankings('alltime')

  const ready = (players ?? []).filter((p) => p.playerReady)
  const totalPlayers = players?.length ?? 0
  const gamesToday = dayGames?.length ?? 0
  const recent = (weekGames ?? []).slice(0, RECENT_GAMES_LIMIT)

  // Rankings sorted by points desc, then alphabetical (server's `position` is
  // tied-at-1 when ELO is unsettled, so we sort here for the "top players" view).
  const top = (rankings ?? [])
    .slice()
    .sort((a, b) => (b.points - a.points) || a.name.localeCompare(b.name))
    .slice(0, TOP_PLAYERS_LIMIT)

  return (
    <div className={styles.wrapper}>
      <section className={styles.statsRow}>
        <StatCard
          label="ready"
          value={ready.length}
          sub={`of ${totalPlayers} players`}
          to="/players"
        />
        <StatCard
          label="games today"
          value={gamesToday}
          sub={`${weekGames?.length ?? 0} this week`}
          to="/games"
        />
        <StatCard label="ranked players" value={rankings?.length ?? 0} to="/rankings" />
      </section>

      <div className={styles.split}>
        <section className={styles.panel}>
          <header className={styles.panelHead}>
            <h3 className={styles.panelTitle}>Top players</h3>
            <Link to="/rankings" className={styles.panelLink}>
              all rankings →
            </Link>
          </header>
          {top.length === 0 && (
            <p className={styles.muted}>No ranked players yet.</p>
          )}
          {top.length > 0 && top.length < 3 && (
            <ol className={styles.topList}>
              {top.map((r, i) => (
                <li key={r.name}>
                  <Link
                    to="/player/$name"
                    params={{ name: r.name }}
                    className={styles.topRow}
                  >
                    <span className={`${styles.medal} ${medalClass(i)}`}>{i + 1}</span>
                    <Avatar name={r.name} className={styles.avatar} />
                    <span className={styles.topName}>{r.name}</span>
                    <span className={styles.topPoints}>{r.points}</span>
                  </Link>
                </li>
              ))}
            </ol>
          )}
          {top.length >= 3 && (
            <div className={styles.podium}>
              <PodiumStep place={2} item={top[1]} />
              <PodiumStep place={1} item={top[0]} />
              <PodiumStep place={3} item={top[2]} />
            </div>
          )}
        </section>

        <section className={styles.panel}>
          <header className={styles.panelHead}>
            <h3 className={styles.panelTitle}>Recent games</h3>
            <Link to="/games" className={styles.panelLink}>
              all games →
            </Link>
          </header>
          {recent.length === 0 ? (
            <p className={styles.muted}>No games this week.</p>
          ) : (
            <ol className={styles.gamesList}>
              {recent.map((g) => (
                <li key={g.id}>
                  <RecentGameRow game={g} />
                </li>
              ))}
            </ol>
          )}
        </section>
      </div>
    </div>
  )
}

const StatCard = ({
  label,
  value,
  sub,
  to,
}: {
  label: string
  value: number
  sub?: string
  to: '/players' | '/games' | '/rankings'
}) => {
  return (
    <Link to={to} className={styles.statCard}>
      <span className={styles.statValue}>{value}</span>
      <span className={styles.statLabel}>{label}</span>
      {sub && <span className={styles.statSub}>{sub}</span>}
    </Link>
  )
}

const PodiumStep = ({ place, item }: { place: 1 | 2 | 3; item: RankingItem }) => {
  return (
    <Link
      to="/player/$name"
      params={{ name: item.name }}
      className={styles.podiumStep}
    >
      <Avatar name={item.name} className={styles.podiumAvatar} />
      <span className={styles.podiumName}>{item.name}</span>
      <span className={styles.podiumPoints}>{item.points}</span>
      <div className={`${styles.platform} ${styles[`place_${place}`]}`}>
        {place}
      </div>
    </Link>
  )
}

const joinTeam = (p1: string | null, p2: string | null): string => {
  return [p1, p2].filter((n): n is string => n != null).join(' & ') || '—'
}

const RecentGameRow = ({ game }: { game: Game }) => {
  const side = winnerSide(game.match_winner)
  const redNames = joinTeam(game.player_red_1, game.player_red_2)
  const blueNames = joinTeam(game.player_blue_1, game.player_blue_2)
  const winnerNames =
    side === 'red' ? redNames : side === 'blue' ? blueNames : null

  return (
    <article className={styles.recentRow}>
      <span className={styles.gameId}>#{game.id}</span>
      <span className={styles.gameTeams}>
        <span className={styles.redTeam}>{redNames}</span>
        <span className={styles.vs}>vs</span>
        <span className={styles.blueTeam}>{blueNames}</span>
      </span>
      <span className={styles.gameOutcome}>
        {side === 'tie' ? 'Tie' : winnerNames ? `${winnerNames} won` : '—'}
      </span>
    </article>
  )
}

const medalClass = (i: number): string => {
  if (i === 0) return styles.gold
  if (i === 1) return styles.silver
  if (i === 2) return styles.bronze
  return ''
}
