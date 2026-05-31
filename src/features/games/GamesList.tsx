import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import {
  invalidateGameDerivedQueriesFor,
  useClearAllGames,
  useDeleteGame,
  useGames,
} from './useGames'
import { winnerSide, type Game, type Side } from './game'
import type { Period } from '@/lib/period'
import { ReportGameForm } from './ReportGameForm'
import { EditGameModal } from './EditGameModal'
import { Avatar } from '@/components/Avatar'
import { PeriodTabs } from '@/components/PeriodTabs'
import { formatDbTimestamp } from '@/lib/time'
import { Fab } from '@/components/Fab'
import { Dialog } from '@/components/Dialog'
import { ErrorNotice } from '@/components/ErrorNotice'
import { ApiError } from '@/lib/api'
import styles from './GamesList.module.css'

// Keep in sync with the .cardExiting animation duration in the module CSS.
// Slightly larger than the actual keyframe length so the row finishes
// fading before React Query refetches and unmounts it.
const EXIT_ANIMATION_MS = 280

type Props = {
  prefill?: { red1: string; red2: string; blue1: string; blue2: string } | null
}

export const GamesList = ({ prefill = null }: Props) => {
  const [period, setPeriod] = useState<Period>('week')
  const { data: games, isPending, error, refetch } = useGames(period)
  const clearAll = useClearAllGames()
  const deleteGame = useDeleteGame()
  const qc = useQueryClient()

  const [reportOpen, setReportOpen] = useState(prefill !== null)
  const [confirmation, setConfirmation] = useState<string | null>(null)
  const [errorBanner, setErrorBanner] = useState<string | null>(null)
  const [editingGame, setEditingGame] = useState<Game | null>(null)
  const [pendingDelete, setPendingDelete] = useState<Game | null>(null)
  const [exitingId, setExitingId] = useState<number | null>(null)

  // If a prefill arrives via search params, open the dialog automatically.
  useEffect(() => {
    if (prefill) setReportOpen(true)
  }, [prefill])

  const flashConfirmation = (msg: string) => {
    setConfirmation(msg)
    window.setTimeout(() => setConfirmation(null), 4000)
  }

  const flashError = (msg: string) => {
    setErrorBanner(msg)
    window.setTimeout(() => setErrorBanner(null), 6000)
  }

  const onClearAll = () => {
    if (
      window.confirm(
        'Delete all recorded games? This wipes the entire history and cannot be undone.',
      )
    ) {
      clearAll.mutate()
    }
  }

  const confirmDelete = () => {
    if (!pendingDelete) return
    const game = pendingDelete
    deleteGame.mutate(game.id, {
      onSuccess: () => {
        // Close the confirm dialog immediately, then start the row's
        // fade-out. Defer the cache invalidation until the animation has
        // had time to play — otherwise the row unmounts the moment the
        // refetch returns and the fade is invisible.
        setPendingDelete(null)
        setExitingId(game.id)
        window.setTimeout(() => {
          invalidateGameDerivedQueriesFor(qc)
          setExitingId(null)
          flashConfirmation(`Deleted game #${game.id}`)
        }, EXIT_ANIMATION_MS)
      },
      onError: (err) => {
        // A 404 here usually means another admin already deleted the game,
        // or the user's list is stale. Phrase the message accordingly so
        // they know to refresh rather than panic.
        const isNotFound = err instanceof ApiError && err.status === 404
        flashError(
          isNotFound
            ? `Game #${game.id} is already deleted or no longer exists.`
            : `Couldn't delete game #${game.id}: ${err.message}`,
        )
        setPendingDelete(null)
      },
    })
  }

  return (
    <div className={styles.wrapper}>
      {confirmation && (
        <p className={styles.confirmation} role="status">
          {confirmation}
        </p>
      )}

      {errorBanner && (
        <p className={styles.errorBanner} role="alert">
          {errorBanner}
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
        <ErrorNotice what="games" error={error} onRetry={() => void refetch()} />
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
              <GameCard
                game={g}
                onEdit={() => setEditingGame(g)}
                onDelete={() => setPendingDelete(g)}
                deleting={deleteGame.isPending && deleteGame.variables === g.id}
                exiting={exitingId === g.id}
              />
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
            flashConfirmation(id ? `Reported as game #${id}` : 'Reported')
          }}
        />
      </Dialog>

      <Dialog
        open={editingGame !== null}
        onClose={() => setEditingGame(null)}
        title="Edit game"
      >
        {editingGame && (
          <EditGameModal
            game={editingGame}
            onClose={() => setEditingGame(null)}
            onSaved={(updated) =>
              flashConfirmation(`Updated game #${updated.id}`)
            }
          />
        )}
      </Dialog>

      <Dialog
        open={pendingDelete !== null}
        onClose={() => {
          if (!deleteGame.isPending) setPendingDelete(null)
        }}
        title="Delete game"
      >
        {pendingDelete && (
          <div className={styles.confirmBody}>
            <p className={styles.confirmText}>
              Delete game <strong>#{pendingDelete.id}</strong>? This cannot
              be undone.
            </p>
            <div className={styles.confirmActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => setPendingDelete(null)}
                disabled={deleteGame.isPending}
              >
                Cancel
              </button>
              <button
                type="button"
                className={styles.dangerButton}
                onClick={confirmDelete}
                disabled={deleteGame.isPending}
              >
                {deleteGame.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        )}
      </Dialog>
    </div>
  )
}

const GameCard = ({
  game,
  onEdit,
  onDelete,
  deleting,
  exiting,
}: {
  game: Game
  onEdit: () => void
  onDelete: () => void
  deleting: boolean
  exiting: boolean
}) => {
  const side = winnerSide(game.match_winner)
  return (
    <article className={`${styles.card} ${exiting ? styles.cardExiting : ''}`}>
      <header className={styles.cardHeader}>
        <span className={styles.gameId}>#{game.id}</span>
        <time className={styles.timestamp}>{formatDbTimestamp(game.lastUpdated)}</time>
        <span className={styles.points}>{game.points_at_stake} pts</span>
        <div className={styles.rowActions}>
          <button
            type="button"
            className={styles.rowButton}
            onClick={onEdit}
            disabled={deleting}
          >
            Edit
          </button>
          <button
            type="button"
            className={`${styles.rowButton} ${styles.danger}`}
            onClick={onDelete}
            disabled={deleting}
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
        </div>
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

