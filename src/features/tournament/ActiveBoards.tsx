import { useReportGame } from '@/features/games/useGames'
import { useRankings } from '@/features/rankings/useRankings'
import type { RankingItem } from '@/features/rankings/ranking'
import { Avatar } from '@/components/Avatar'
import type { TournamentGame, TournamentRound } from './tournament'
import styles from './ActiveBoards.module.css'

type BoardKey = string

export type BoardState = {
  status: 'pending' | 'reporting' | 'reported' | 'failed'
  reportedAs?: number
  error?: string
}

export type BoardStateMap = Record<BoardKey, BoardState>

type Props = {
  rounds: TournamentRound[]
  tableNames: string[]
  states: BoardStateMap
  setStates: (next: BoardStateMap | ((prev: BoardStateMap) => BoardStateMap)) => void
}

const DEFAULT_PLAYER_RATING = 1500

type TableColor = { name: string; hex: string }
type TablePalette = { red: TableColor; blue: TableColor }

// Table-specific colors mirror the original Angular implementation
// (`teamsColors = ['Grøn/Rød', 'Orange/Blå', 'Lilla/Sort', 'Pink/Lime']`).
// Player slot mapping: red side = first colour, blue side = second colour.
const TABLE_PALETTES: TablePalette[] = [
  { red: { name: 'Green', hex: '#2e7d32' }, blue: { name: 'Red', hex: '#d04a4a' } },
  { red: { name: 'Orange', hex: '#e07c0e' }, blue: { name: 'Blue', hex: '#4a78d0' } },
  { red: { name: 'Purple', hex: '#7b3fb0' }, blue: { name: 'Black', hex: '#3a3a3a' } },
  { red: { name: 'Pink', hex: '#d04097' }, blue: { name: 'Lime', hex: '#7fa820' } },
]

const paletteFor = (tableIndex: number): TablePalette => {
  return TABLE_PALETTES[tableIndex % TABLE_PALETTES.length]
}

export const ActiveBoards = ({ rounds, tableNames, states, setStates }: Props) => {
  const { data: rankings } = useRankings('alltime')

  return (
    <div className={styles.boards}>
      {rounds.map((round, roundIdx) =>
        round.games.map((game, gameIdx) => {
          const key = `${roundIdx}-${gameIdx}`
          const tableLabel =
            rounds.length > 1
              ? `Round ${roundIdx + 1} · ${tableLabelFor(gameIdx, tableNames)}`
              : tableLabelFor(gameIdx, tableNames)

          return (
            <BoardCard
              key={key}
              game={game}
              tableLabel={tableLabel}
              tableIndex={gameIdx}
              palette={paletteFor(gameIdx)}
              rankings={rankings}
              state={states[key] ?? { status: 'pending' }}
              setState={(s) => setStates((prev) => ({ ...prev, [key]: s }))}
            />
          )
        }),
      )}
    </div>
  )
}

const BoardCard = ({
  game,
  tableLabel,
  tableIndex,
  palette,
  rankings,
  state,
  setState,
}: {
  game: TournamentGame
  tableLabel: string
  tableIndex: number
  palette: TablePalette
  rankings: RankingItem[] | undefined
  state: BoardState
  setState: (s: BoardState) => void
}) => {
  const reportGame = useReportGame()

  const redCount =
    (game.player_red_1 ? 1 : 0) + (game.player_red_2 ? 1 : 0)
  const blueCount =
    (game.player_blue_1 ? 1 : 0) + (game.player_blue_2 ? 1 : 0)
  const canReport = redCount >= 1 && blueCount >= 1

  const redTotal = teamTotal(rankings, game.player_red_1, game.player_red_2)
  const blueTotal = teamTotal(rankings, game.player_blue_1, game.player_blue_2)
  const stakes = calculateStakes(redTotal, blueTotal)

  const onWinner = (winner: 'red' | 'blue' | 'draw') => {
    if (!canReport) return
    setState({ status: 'reporting' })
    const points = winner === 'red' ? stakes.redWin : winner === 'blue' ? stakes.blueWin : 0
    reportGame.mutate(
      {
        red1: game.player_red_1,
        red2: game.player_red_2,
        blue1: game.player_blue_1,
        blue2: game.player_blue_2,
        winner,
        points,
        table: tableIndex + 1,
      },
      {
        onSuccess: (res) => {
          const id = res.newGameIDs?.[0]
          setState({
            status: 'reported',
            reportedAs: id ? Number(id) : undefined,
          })
        },
        onError: (err) => {
          setState({ status: 'failed', error: err.message })
        },
      },
    )
  }

  const isReported = state.status === 'reported'
  const isReporting = state.status === 'reporting'

  return (
    <article className={`${styles.board} ${isReported ? styles.reported : ''}`}>
      {isReported && (
        <header className={styles.header}>
          <span className={styles.reportedBadge}>
            ✓ Reported{state.reportedAs ? ` as #${state.reportedAs}` : ''}
          </span>
        </header>
      )}

      <div className={styles.match}>
        <Team
          color={palette.red}
          one={game.player_red_1}
          two={game.player_red_2}
          rankings={rankings}
        />
        <div className={styles.imageWrap}>
          <img
            src={`/img/fussball-table-nummer-${tableIndex + 1}.png`}
            alt=""
            className={styles.tableImage}
            onError={(e) => {
              // No image for boards beyond what was supplied; hide gracefully.
              e.currentTarget.style.display = 'none'
            }}
          />
          <span className={styles.tableLabelOverlay}>{tableLabel}</span>
        </div>
        <Team
          color={palette.blue}
          one={game.player_blue_1}
          two={game.player_blue_2}
          rankings={rankings}
        />
      </div>

      {!canReport && (
        <p className={styles.note}>
          One side has no players — can't be reported.
        </p>
      )}

      {!isReported && canReport && (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.winnerButton}
            style={{ background: palette.red.hex, borderColor: palette.red.hex, color: '#fff' }}
            disabled={isReporting}
            onClick={() => onWinner('red')}
          >
            <span>{palette.red.name} won</span>
            <span className={styles.buttonStakes}>+{stakes.redWin} pts</span>
          </button>
          <button
            type="button"
            className={`${styles.winnerButton} ${styles.tie}`}
            disabled={isReporting}
            onClick={() => onWinner('draw')}
          >
            <span>Tie</span>
            <span className={styles.buttonStakes}>no points</span>
          </button>
          <button
            type="button"
            className={styles.winnerButton}
            style={{ background: palette.blue.hex, borderColor: palette.blue.hex, color: '#fff' }}
            disabled={isReporting}
            onClick={() => onWinner('blue')}
          >
            <span>{palette.blue.name} won</span>
            <span className={styles.buttonStakes}>+{stakes.blueWin} pts</span>
          </button>
        </div>
      )}

      {state.status === 'failed' && state.error && (
        <p className={styles.error}>Failed to report: {state.error}</p>
      )}
    </article>
  )
}

const Team = ({
  color,
  one,
  two,
  rankings,
}: {
  color: TableColor
  one: string | null
  two: string | null
  rankings: RankingItem[] | undefined
}) => {
  const names = [one, two].filter((p): p is string => p != null)
  const isSolo = names.length === 1

  return (
    <div
      className={`${styles.team} ${isSolo ? styles.solo : ''}`}
      style={{ borderLeft: `4px solid ${color.hex}` }}
    >
      {names.length === 0 ? (
        <span className={styles.empty}>No players</span>
      ) : (
        <div className={styles.players}>
          {names.map((n) => (
            <PlayerSlot key={n} name={n} rankings={rankings} />
          ))}
        </div>
      )}
      {isSolo && <span className={styles.soloNote}>plays alone</span>}
    </div>
  )
}

const PlayerSlot = ({
  name,
  rankings,
}: {
  name: string
  rankings: RankingItem[] | undefined
}) => {
  return (
    <div className={styles.playerSlot}>
      <Avatar name={name} className={styles.avatar} />
      <span className={styles.playerName}>{name}</span>
      <span className={styles.playerRank}>{formatPosition(rankings, name)}</span>
    </div>
  )
}

const tableLabelFor = (index: number, tableNames: string[]): string => {
  return tableNames[index] ?? `Table ${index + 1}`
}

const getPlayerPoints = (
  rankings: RankingItem[] | undefined,
  name: string | null,
): number => {
  if (!name) return 0
  return rankings?.find((r) => r.name === name)?.points ?? DEFAULT_PLAYER_RATING
}

const formatPosition = (rankings: RankingItem[] | undefined, name: string): string => {
  const item = rankings?.find((r) => r.name === name)
  if (!item) return 'unranked'
  return `#${item.position}`
}

const teamTotal = (
  rankings: RankingItem[] | undefined,
  p1: string | null,
  p2: string | null,
): number => {
  return getPlayerPoints(rankings, p1) + getPlayerPoints(rankings, p2)
}

// ELO-style stakes ported from the original Angular UI
// (`games-overview.component.ts`). Each side has a *different* potential
// reward: a low-rated team beating a high-rated team gets a bigger share of
// the K factor, and the inverse for the favored team. A tie awards no
// points (handled at the call site by sending 0).
const calculateStakes = (redTotal: number, blueTotal: number) => {
  const K = 50
  const redDiff = blueTotal - redTotal
  const redWe = 1 / (Math.pow(10, redDiff / 1000) + 1)
  const blueWe = 1 - redWe
  let redWin = Math.floor(K * (1 - redWe))
  let blueWin = Math.floor(K * (1 - blueWe))
  // The two parseInt-truncations in the old code can shave 1-2 points off the
  // K total. Bump the smaller-but-not-tiny side back up so the pair still
  // sums to K. Mirrors the old guard.
  if (redWin + blueWin < K) {
    if (blueWin < redWin) blueWin = K - redWin
    else redWin = K - blueWin
  }
  return { redWin, blueWin }
}
