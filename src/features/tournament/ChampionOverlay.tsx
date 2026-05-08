import { useEffect, useRef } from 'react'
import { Avatar } from '@/components/Avatar'
import type { RankingItem } from '@/features/rankings/ranking'
import styles from './ChampionOverlay.module.css'

const AUTO_DISMISS_MS = 5000

type Props = {
  top: RankingItem[]
  onDismiss: () => void
}

export const ChampionOverlay = ({ top, onDismiss }: Props) => {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const id = window.setTimeout(onDismiss, AUTO_DISMISS_MS)
    return () => window.clearTimeout(id)
  }, [onDismiss])

  // Escape dismisses; initial focus so screen readers announce the dialog.
  useEffect(() => {
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDismiss])

  // top is sorted highest-points-first. Empty top makes no sense here, but
  // guard anyway so the overlay can't render an undefined champion.
  if (top.length === 0) return null

  return (
    <div
      ref={ref}
      className={styles.overlay}
      role="dialog"
      aria-label="New leader"
      aria-modal="true"
      tabIndex={-1}
      onClick={onDismiss}
    >
      <div className={styles.title}>🏆 New leader</div>
      <div className={styles.podium}>
        {top[1] && <Step item={top[1]} place={2} />}
        {top[0] && <Step item={top[0]} place={1} />}
        {top[2] && <Step item={top[2]} place={3} />}
      </div>
    </div>
  )
}

const Step = ({ item, place }: { item: RankingItem; place: 1 | 2 | 3 }) => {
  return (
    <div className={`${styles.step} ${styles[`step_${place}`]}`}>
      <Avatar name={item.name} className={styles.avatar} />
      <span className={styles.name}>{item.name}</span>
      <span className={styles.points}>{item.points}</span>
      <div className={`${styles.platform} ${styles[`platform_${place}`]}`}>
        {place}
      </div>
    </div>
  )
}
