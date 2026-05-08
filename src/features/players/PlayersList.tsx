import { useEffect, useMemo, useRef, useState } from 'react'
import {
  useLastPlayed,
  usePlayers,
  useSetAllPlayersReady,
  useTogglePlayerReady,
} from './usePlayers'
import { AddPlayerForm } from './AddPlayerForm'
import { Avatar } from '@/components/Avatar'
import { Fab } from '@/components/Fab'
import { Dialog } from '@/components/Dialog'
import styles from './PlayersList.module.css'

const HIGHLIGHT_MS = 2000
const ACTIVE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export const PlayersList = () => {
  const { data: players, isPending, error } = usePlayers()
  const { data: lastPlayed } = useLastPlayed()
  const toggle = useTogglePlayerReady()
  const setAll = useSetAllPlayersReady()

  const [highlightedName, setHighlightedName] = useState<string | null>(null)
  const highlightRef = useRef<HTMLLIElement | null>(null)
  const [addOpen, setAddOpen] = useState(false)

  // Clear the highlight after the flash plays out so a future add can re-trigger it.
  useEffect(() => {
    if (!highlightedName) return
    const timer = setTimeout(() => setHighlightedName(null), HIGHLIGHT_MS)
    return () => clearTimeout(timer)
  }, [highlightedName])

  // Once the new player is in the rendered list, scroll the matching card into view.
  useEffect(() => {
    if (highlightedName && players?.some((p) => p.name === highlightedName)) {
      highlightRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    }
  }, [highlightedName, players])

  const sorted = useMemo(() => {
    if (!players) return []
    return [...players].sort((a, b) => a.name.localeCompare(b.name))
  }, [players])

  if (isPending) return <p>Loading players…</p>
  if (error) return <p className={styles.error}>Failed to load players: {error.message}</p>

  const selectedCount = players.filter((p) => p.playerReady).length

  return (
    <div className={styles.wrapper}>
      <div className={styles.toolbar}>
        <span className={styles.count}>
          {selectedCount} / {players.length} selected
        </span>
        <div className={styles.toolbarActions}>
          <button
            type="button"
            className={styles.toolbarButton}
            disabled={setAll.isPending || selectedCount === players.length}
            onClick={() => setAll.mutate({ players, ready: true })}
          >
            Select all
          </button>
          <button
            type="button"
            className={styles.toolbarButton}
            disabled={setAll.isPending || selectedCount === 0}
            onClick={() => setAll.mutate({ players, ready: false })}
          >
            Clear all
          </button>
        </div>
      </div>

      <ul className={styles.list}>
        {sorted.map((p) => {
          const isHighlighted = p.name === highlightedName
          const ts = lastPlayed?.[p.name]
          const isRecentlyActive =
            ts != null && Date.now() - ts < ACTIVE_WINDOW_MS
          return (
            <li key={p.name} ref={isHighlighted ? highlightRef : null}>
              <button
                type="button"
                className={cn(
                  styles.card,
                  p.playerReady && styles.selected,
                  isHighlighted && styles.highlight,
                )}
                aria-pressed={p.playerReady}
                onClick={() => toggle.mutate(p)}
              >
                {isRecentlyActive && (
                  <span
                    className={styles.activeDot}
                    aria-label="Played in the last 30 days"
                    title="Played in the last 30 days"
                  />
                )}
                <Avatar name={p.name} className={styles.avatar} />
                <span className={styles.name}>{p.name}</span>
                {p.playerReady && (
                  <span className={styles.check} aria-label="selected">
                    ✓
                  </span>
                )}
              </button>
            </li>
          )
        })}
      </ul>

      <Fab onClick={() => setAddOpen(true)} label="Add player" />
      <Dialog open={addOpen} onClose={() => setAddOpen(false)} title="Add player">
        <AddPlayerForm
          onCancel={() => setAddOpen(false)}
          onAdded={(name) => {
            setAddOpen(false)
            setHighlightedName(name)
          }}
        />
      </Dialog>
    </div>
  )
}

const cn = (...parts: Array<string | false | null | undefined>) => {
  return parts.filter(Boolean).join(' ')
}

