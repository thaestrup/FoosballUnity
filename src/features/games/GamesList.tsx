import { useEffect, useState } from 'react'
import { useClearAllGames, useGames } from './useGames'
import { winnerSide, type Game, type Side } from './game'
import type { Period } from '@/lib/period'
import { ReportGameForm } from './ReportGameForm'
import { Avatar } from '@/components/Avatar'
import { PeriodTabs } from '@/components/PeriodTabs'
import { formatDbTimestamp } from '@/lib/time'
import { Fab } from '@/components/Fab'
import { Dialog } from '@/components/Dialog'
import styles from './GamesList.module.css'

type Props = {
  prefill?: { red1: string; red2: string; blue1: string; blue2: string } | null
}

export const GamesList = ({ prefill = null }: Props) => {
  const [period, setPeriod] = useState<Period>('week')
  const { data: games, isPending, error } = useGames(period)
  const clearAll = useClearAllGames()

  const [reportOpen, setReportOpen] = useState(prefill !== null)
  const [confirmation, setConfirmation] = useState<string | null>(null)

  // If a prefill arrives via search params, open the dialog automatically.
  useEffect(() => {
    if (prefill) setReportOpen(true)
  }, [prefill])

  const onClearAll = () => {
    if (
      window.confirm(
        'Delete all recorded games? This wipes the entire history and cannot be undone.',
      )
    ) {
      clearAll.mutate()
    }
  }

  return (
    <div className={styles.wrapper}>
      {confirmation && (
        <p className={styles.confirmation} role="status">
          {confirmation}
        </p>
      )}

      <div className={styles.tabsRow}>
        <PeriodTabs value={period} onChange={setPeriod} />
        <button
          type="button"
          className={styles.clearAll}
          onClick={onClearAll}
          disabled={clearAll.isPending || (games?.length ?? 0) === 0}
        >
          {clearAll.isPending ? 'Clearing…' : 'Clear all games'}
        </button>
      </div>

      {isPending && <p className={styles.muted}>Loading games…</p>}
      {error && (
        <p className={styles.error}>Failed to load games: {error.message}</p>
      )}
      {games && games.length === 0 && (
        <p className={styles.muted}>
          No games in this period. Played games will appear here.
        </p>
      )}
      {games && games.length > 0 && (
        <ol className={styles.list}>
          {games.map((g) => (
            <li key={g.id}>
              <GameCard game={g} />
            </li>
          ))}
        </ol>
      )}

      <Fab onClick={() => setReportOpen(true)} label="Report game" />
      <Dialog
        open={reportOpen}
        onClose={() => setReportOpen(false)}
        title="Report game"
      >
        <ReportGameForm
          prefill={prefill}
          onCancel={() => setReportOpen(false)}
          onReported={(id) => {
            setReportOpen(false)
            setConfirmation(id ? `Reported as game #${id}` : 'Reported')
            window.setTimeout(() => setConfirmation(null), 4000)
          }}
        />
      </Dialog>
    </div>
  )
}

const GameCard = ({ game }: { game: Game }) => {
  const side = winnerSide(game.match_winner)
  return (
    <article className={styles.card}>
      <header className={styles.cardHeader}>
        <span className={styles.gameId}>#{game.id}</span>
        <time className={styles.timestamp}>{formatDbTimestamp(game.lastUpdated)}</time>
        <span className={styles.points}>{game.points_at_stake} pts</span>
      </header>
      <div className={styles.match}>
        <Team
          color="red"
          one={game.player_red_1}
          two={game.player_red_2}
          outcome={outcomeFor('red', side)}
        />
        <span className={styles.versus} aria-hidden="true">
          vs
        </span>
        <Team
          color="blue"
          one={game.player_blue_1}
          two={game.player_blue_2}
          outcome={outcomeFor('blue', side)}
        />
      </div>
    </article>
  )
}

type Outcome = 'win' | 'loss' | 'tie' | 'unknown'

const outcomeFor = (team: 'red' | 'blue', winner: Side): Outcome => {
  if (winner === 'tie') return 'tie'
  if (winner === team) return 'win'
  if (winner === 'unknown') return 'unknown'
  return 'loss'
}

const Team = ({
  color,
  one,
  two,
  outcome,
}: {
  color: 'red' | 'blue'
  one: string | null
  two: string | null
  outcome: Outcome
}) => {
  const names = [one, two].filter((n): n is string => n != null)
  return (
    <div
      className={`${styles.team} ${styles[`team_${color}`]} ${styles[`outcome_${outcome}`]}`}
    >
      {names.map((name) => (
        <Avatar key={name} name={name} className={styles.avatar} />
      ))}
      <span className={styles.teamLabel}>
        {names.length > 0 ? names.join(' & ') : 'No players'}
      </span>
      {outcome !== 'unknown' && (
        <span className={styles.outcomeBadge}>{outcomeLabel(outcome)}</span>
      )}
    </div>
  )
}

const outcomeLabel = (outcome: Outcome): string => {
  switch (outcome) {
    case 'win':
      return 'Won'
    case 'loss':
      return 'Lost'
    case 'tie':
      return 'Tie'
    default:
      return ''
  }
}

