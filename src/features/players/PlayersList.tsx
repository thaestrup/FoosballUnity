import { useEffect, useMemo, useRef, useState } from 'react'
import {
  useLastPlayed,
  usePlayers,
  useSetAllPlayersReady,
  useTogglePlayerReady,
} from './usePlayers'
import { AddPlayerForm } from './AddPlayerForm'
import { EditPlayerDialog } from './EditPlayerDialog'
import { Avatar } from '@/components/Avatar'
import { Fab } from '@/components/Fab'
import { Dialog } from '@/components/Dialog'
import { ErrorNotice } from '@/components/ErrorNotice'
import type { Player } from './player'
import styles from './PlayersList.module.css'

const HIGHLIGHT_MS = 2000
const ACTIVE_WINDOW_MS = 30 * 24 * 60 * 60 * 1000 // 30 days

export const PlayersList = () => {
  const { data: players, isPending, error, refetch } = usePlayers()
  const { data: lastPlayed } = useLastPlayed()
  const toggle = useTogglePlayerReady()
  const setAll = useSetAllPlayersReady()

  const [highlightedName, setHighlightedName] = useState<string | null>(null)
  const highlightRef = useRef<HTMLLIElement | null>(null)
  const [addOpen, setAddOpen] = useState(false)
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null)

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
  if (error)
    return (
      <ErrorNotice what="players" error={error} onRetry={() => void refetch()} />
    )

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
            <li
              key={p.name}
              ref={isHighlighted ? highlightRef : null}
              className={styles.cardWrapper}
            >
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
              <button
                type="button"
                className={styles.editBtn}
                onClick={() => setEditingPlayer(p)}
                aria-label={`Edit ${p.name}`}
                title={`Edit ${p.name}`}
              >
                ✎
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

      <Dialog
        open={editingPlayer !== null}
        onClose={() => setEditingPlayer(null)}
        title="Edit player"
      >
        {editingPlayer && (
          <EditPlayerDialog
            player={editingPlayer}
            onClose={() => setEditingPlayer(null)}
            onSaved={(newName) => {
              // If the name changed, focus + highlight the renamed card
              // on its new position so the user can see where it landed.
              if (newName !== editingPlayer.name) {
                setHighlightedName(newName)
              }
            }}
          />
        )}
      </Dialog>
    </div>
  )
}

const cn = (...parts: Array<string | false | null | undefined>) => {
  return parts.filter(Boolean).join(' ')
}

