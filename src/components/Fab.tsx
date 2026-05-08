import type { ReactNode } from 'react'
import styles from './Fab.module.css'

type Props = {
  onClick: () => void
  label: string
  icon?: ReactNode
}

export const Fab = ({ onClick, label, icon }: Props) => {
  return (
    <button
      type="button"
      className={styles.fab}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      {icon ?? '+'}
    </button>
  )
}
