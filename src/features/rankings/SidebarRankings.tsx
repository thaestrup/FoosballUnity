import { useMemo, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useRankings } from './useRankings'
import type { Period } from '@/lib/period'
import { Avatar } from '@/components/Avatar'
import { PeriodTabs } from '@/components/PeriodTabs'
import styles from './SidebarRankings.module.css'

const LIMIT = 10

export const SidebarRankings = () => {
  const [period, setPeriod] = useState<Period>('alltime')
  const { data: rankings, isPending } = useRankings(period)

  const sorted = useMemo(() => {
    if (!rankings) return []
    return [...rankings]
      .sort((a, b) => b.points - a.points || a.name.localeCompare(b.name))
      .slice(0, LIMIT)
  }, [rankings])

  return (
    <div className={styles.wrapper}>
      <PeriodTabs value={period} onChange={setPeriod} variant="short" />

      {isPending ? (
        <p className={styles.muted}>Loading…</p>
      ) : sorted.length === 0 ? (
        <p className={styles.muted}>No ranked players yet.</p>
      ) : (
        <ol className={styles.list}>
          {sorted.map((r, i) => (
            <li key={r.name}>
              <Link
                to="/player/$name"
                params={{ name: r.name }}
                className={styles.row}
              >
                <span className={`${styles.medal} ${medalClass(i)}`}>{i + 1}</span>
                <Avatar name={r.name} className={styles.avatar} />
                <span className={styles.name}>{r.name}</span>
                <span className={styles.points}>{r.points}</span>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </div>
  )
}

const medalClass = (i: number): string => {
  if (i === 0) return styles.gold
  if (i === 1) return styles.silver
  if (i === 2) return styles.bronze
  return ''
}
