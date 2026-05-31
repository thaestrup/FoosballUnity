import { useReportGame } from '@/features/games/useGames'
import { useRankings } from '@/features/rankings/useRankings'
import type { RankingItem } from '@/features/rankings/ranking'
import { calculateStakes, teamTotal } from '@/features/rankings/stakes'
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
  // When false, 2v1 games (exactly one back-row slot null) are filtered out
  // before rendering — the user opted out of uneven teams. Defaults to true
  // so the existing prop-less call sites keep their current behaviour.
  allowUneven?: boolean
}

// 1v1: both back-row slots null, both front slots filled. Rendered as a
// proper 1v1 (no "plays alone" badges, "· 1v1" appended to the label).
const is1v1Game = (g: TournamentGame) =>
  g.player_red_2 == null &&
  g.player_blue_2 == null &&
  g.player_red_1 != null &&
  g.player_blue_1 != null

// 2v1: exactly one back-row slot null. Hidden unless the user enabled uneven
// teams. (Front slots are filled in order by the backend, so the back row
// is where the gaps land.)
const is2v1Game = (g: TournamentGame) =>
  (g.player_red_2 == null) !== (g.player_blue_2 == null)

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

export const ActiveBoards = ({
  rounds,
  tableNames,
  states,
  setStates,
  allowUneven = true,
}: Props) => {
  const { data: rankings } = useRankings('alltime')

  return (
    <div className={styles.boards}>
      {rounds.map((round, roundIdx) =>
        round.games.map((game, gameIdx) => {
          if (!allowUneven && is2v1Game(game)) return null
          const key = `${roundIdx}-${gameIdx}`
          const is1v1 = is1v1Game(game)
          const baseLabel = tableLabelFor(gameIdx, tableNames)
          const labelWithMode = is1v1 ? `${baseLabel} · 1v1` : baseLabel
          const tableLabel =
            rounds.length > 1
              ? `Round ${roundIdx + 1} · ${labelWithMode}`
              : labelWithMode

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
              is1v1={is1v1}
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
  is1v1,
}: {
  game: TournamentGame
  tableLabel: string
  tableIndex: number
  palette: TablePalette
  rankings: RankingItem[] | undefined
  state: BoardState
  setState: (s: BoardState) => void
  is1v1: boolean
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
          is1v1={is1v1}
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
          is1v1={is1v1}
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
  is1v1 = false,
}: {
  color: TableColor
  one: string | null
  two: string | null
  rankings: RankingItem[] | undefined
  // When the whole match is a 1v1, both teams have exactly one player by
  // design — we don't show the "plays alone" badge or solo tint, because
  // neither side is short-handed.
  is1v1?: boolean
}) => {
  const names = [one, two].filter((p): p is string => p != null)
  const isSolo = !is1v1 && names.length === 1

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

const formatPosition = (rankings: RankingItem[] | undefined, name: string): string => {
  const item = rankings?.find((r) => r.name === name)
  if (!item) return 'unranked'
  return `#${item.position}`
}
