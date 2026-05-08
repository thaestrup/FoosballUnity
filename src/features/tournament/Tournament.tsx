import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import confetti from 'canvas-confetti'
import { usePlayers } from '@/features/players/usePlayers'
import { useConfiguration } from '@/features/configuration/useConfiguration'
import { getNumberOfTables, getTableNames } from '@/features/configuration/configuration'
import { Countdown } from '@/features/timer/Countdown'
import { useRankings } from '@/features/rankings/useRankings'
import { SidebarRankings } from '@/features/rankings/SidebarRankings'
import type { RankingItem } from '@/features/rankings/ranking'
import { useStoredJSON } from '@/lib/useStoredJSON'
import { useGenerateTournament } from './useTournament'
import { ALGORITHMS, type Algorithm, type TournamentRound } from './tournament'
import { ActiveBoards, type BoardStateMap } from './ActiveBoards'
import { ChampionOverlay } from './ChampionOverlay'
import styles from './Tournament.module.css'

const MIN_PLAYERS = 4

export const Tournament = () => {
  const { data: players } = usePlayers()
  const { data: config } = useConfiguration()
  const [algorithm, setAlgorithm] = useStoredJSON<Algorithm>(
    'tournament:algorithm',
    'awesomeAlgorithmTournament',
  )
  const [boardsOverride, setBoardsOverride] = useStoredJSON<number | null>(
    'tournament:boardsOverride',
    null,
  )
  // Intentionally NOT persisted — defaults to off on every visit.
  const [allowUneven, setAllowUneven] = useState(false)
  const [rounds, setRounds] = useStoredJSON<TournamentRound[] | null>(
    'tournament:rounds',
    null,
  )
  const [boardStates, setBoardStates] = useStoredJSON<BoardStateMap>(
    'tournament:boardStates',
    {},
  )
  const generate = useGenerateTournament()

  // Plays /sounds/fanfare.wav when the set of players tied for #1 changes
  // (someone gets dethroned, joins the tie, or drops out). Mirrors the
  // original Angular behaviour but lives on this page since this is where
  // games actually get reported.
  const { data: rankings } = useRankings('alltime')
  const fanfare = useMemo(() => {
    const a = new Audio('/sounds/fanfare.wav')
    a.preload = 'auto'
    a.load()
    return a
  }, [])
  const previousTopRef = useRef<Set<string> | null>(null)
  const [celebrationTop, setCelebrationTop] = useState<RankingItem[] | null>(null)

  useEffect(() => {
    if (!rankings || rankings.length === 0) return
    const topPoints = Math.max(...rankings.map((r) => r.points))
    const newTop = new Set(
      rankings.filter((r) => r.points === topPoints).map((r) => r.name),
    )
    const prev = previousTopRef.current
    if (prev != null) {
      const same =
        prev.size === newTop.size && [...prev].every((n) => newTop.has(n))
      if (!same) {
        const clone = fanfare.cloneNode(true) as HTMLAudioElement
        void clone.play().catch(() => {
          /* autoplay blocked — ignore */
        })
        celebrate()
        const top3 = [...rankings]
          .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
          .slice(0, 3)
        setCelebrationTop(top3)
      }
    }
    previousTopRef.current = newTop
  }, [rankings, fanfare])

  // Mirror the mutation's data into persisted storage so navigating away and
  // back doesn't lose the generated tournament. We display whatever the
  // backend produced — no post-processing.
  useEffect(() => {
    if (generate.data) {
      setRounds(generate.data)
      setBoardStates({})
    }
  }, [generate.data, setRounds, setBoardStates])

  const ready = useMemo(() => (players ?? []).filter((p) => p.playerReady), [players])
  const configuredBoards = getNumberOfTables(config)
  const tableNames = getTableNames(config)
  const boards = boardsOverride ?? configuredBoards
  const canGenerate = ready.length >= MIN_PLAYERS
  const totalGenerated = rounds?.reduce((acc, r) => acc + r.games.length, 0) ?? 0

  const onGenerate = () => {
    if (!canGenerate) return
    // When uneven teams are disabled, drop one player if the count is odd so
    // the backend gets an even number and can't produce a 2v1. This is a
    // partial mitigation only; full "even teams only" support requires a
    // backend change (logged in FINDINGS).
    const playersToSend =
      !allowUneven && ready.length % 2 === 1 ? ready.slice(0, ready.length - 1) : ready
    generate.mutate({ algorithm, numberOfGames: boards, players: playersToSend })
  }

  return (
    <div className={styles.layout}>
      <main className={styles.main}>
        {generate.isError && (
          <p className={styles.error}>Failed to generate: {generate.error.message}</p>
        )}

        {rounds && totalGenerated > 0 && totalGenerated < boards && (
          <p className={styles.muted}>
            Generated {totalGenerated} of {boards} boards — {ready.length} ready
            player{ready.length === 1 ? '' : 's'} only fits {totalGenerated}.
          </p>
        )}

        {rounds && totalGenerated > 0 && (
          <ActiveBoards
            rounds={rounds}
            tableNames={tableNames}
            states={boardStates}
            setStates={setBoardStates}
          />
        )}

        {rounds && totalGenerated === 0 && (
          <p className={styles.muted}>
            The algorithm produced no pairings for this input.
          </p>
        )}

        {!rounds && (
          <p className={styles.muted}>
            Use the controls to generate a set of pairings. Make sure the
            players you want to include are marked ready on{' '}
            <Link to="/players" className={styles.link}>
              the players page
            </Link>
            .
          </p>
        )}
      </main>

      <aside className={styles.sidebar}>
        <section className={styles.timerSection}>
          <h3 className={styles.sectionTitle}>Match timer</h3>
          <Countdown />
        </section>

        <details className={styles.accordion}>
          <summary className={styles.summary}>Tournament options</summary>
          <div className={styles.accordionBody}>
            <label className={styles.field}>
              <span>Algorithm</span>
              <select
                className={styles.select}
                value={algorithm}
                onChange={(e) => setAlgorithm(e.target.value as Algorithm)}
              >
                {ALGORITHMS.map((a) => (
                  <option key={a.key} value={a.key}>
                    {a.label}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span>Boards</span>
              <input
                type="number"
                min={1}
                max={20}
                value={boards}
                onChange={(e) => {
                  const n = Number(e.target.value)
                  if (!Number.isNaN(n))
                    setBoardsOverride(Math.max(1, Math.min(20, n)))
                }}
                className={styles.numberInput}
              />
            </label>

            <label className={styles.checkbox}>
              <input
                type="checkbox"
                checked={allowUneven}
                onChange={(e) => setAllowUneven(e.target.checked)}
              />
              Allow uneven teams (solo)
            </label>
          </div>
        </details>

        {!canGenerate && (
          <p className={styles.warn}>
            Need at least {MIN_PLAYERS} ready players.{' '}
            <Link to="/players" className={styles.link}>
              Mark more
            </Link>
          </p>
        )}

        <button
          type="button"
          className={styles.generate}
          onClick={onGenerate}
          disabled={!canGenerate || generate.isPending}
        >
          {generate.isPending ? 'Generating…' : 'Generate'}
        </button>

        <details className={styles.accordion} open>
          <summary className={styles.summary}>Rankings</summary>
          <div className={styles.accordionBody}>
            <SidebarRankings />
          </div>
        </details>
      </aside>

      {celebrationTop && (
        <ChampionOverlay
          top={celebrationTop}
          onDismiss={() => setCelebrationTop(null)}
        />
      )}
    </div>
  )
}

// Confetti celebration: bursts from both bottom corners, fan inward, then
// fall under gravity. Three short staggered volleys make it feel lively
// rather than a single pop. Respects prefers-reduced-motion.
const celebrate = () => {
  if (
    typeof window !== 'undefined' &&
    window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  ) {
    return
  }

  const colors = [
    '#f5d142', // gold
    '#d04a4a', // red
    '#4a78d0', // blue
    '#7b3fb0', // purple
    '#e07c0e', // orange
    '#7fa820', // lime
    '#d04097', // pink
    '#2e7d32', // green
  ]

  const baseOptions: confetti.Options = {
    particleCount: 80,
    spread: 75,
    startVelocity: 55,
    gravity: 1.1,
    ticks: 220,
    scalar: 1.05,
    colors,
  }

  const fire = () => {
    confetti({
      ...baseOptions,
      angle: 60, // up-and-to-the-right
      origin: { x: 0, y: 0.9 },
    })
    confetti({
      ...baseOptions,
      angle: 120, // up-and-to-the-left
      origin: { x: 1, y: 0.9 },
    })
  }

  fire()
  window.setTimeout(fire, 220)
  window.setTimeout(fire, 460)
}

