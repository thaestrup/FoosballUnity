import {
  PERIODS,
  PERIOD_LABELS,
  PERIOD_LABELS_SHORT,
  type Period,
} from '@/lib/period'
import styles from './PeriodTabs.module.css'

type Props = {
  value: Period
  onChange: (next: Period) => void
  variant?: 'full' | 'short'
  className?: string
}

export const PeriodTabs = ({ value, onChange, variant = 'full', className }: Props) => {
  const labels = variant === 'short' ? PERIOD_LABELS_SHORT : PERIOD_LABELS
  const wrapperClass =
    variant === 'short' ? `${styles.tabs} ${styles.short}` : styles.tabs

  return (
    <div className={className ? `${wrapperClass} ${className}` : wrapperClass}>
      {PERIODS.map((p) => (
        <button
          key={p}
          type="button"
          aria-current={p === value ? 'true' : undefined}
          className={`${styles.tab} ${p === value ? styles.active : ''}`}
          onClick={() => onChange(p)}
        >
          {labels[p]}
        </button>
      ))}
    </div>
  )
}
