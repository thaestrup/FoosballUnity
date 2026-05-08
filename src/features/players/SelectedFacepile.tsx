import { Link } from '@tanstack/react-router'
import { usePlayers } from './usePlayers'
import { Avatar } from '@/components/Avatar'
import styles from './SelectedFacepile.module.css'

const MAX_AVATARS = 4

export const SelectedFacepile = () => {
  const { data: players } = usePlayers()
  if (!players) return null

  const selected = players.filter((p) => p.playerReady)
  const visible = selected.slice(0, MAX_AVATARS)
  const overflow = selected.length - visible.length

  const label =
    selected.length === 0
      ? 'No players selected'
      : `${selected.length} player${selected.length === 1 ? '' : 's'} ready`

  return (
    <Link to="/players" className={styles.link} aria-label={label} title={label}>
      {visible.length > 0 && (
        <span className={styles.facepile} aria-hidden="true">
          {visible.map((p) => (
            <Avatar key={p.name} name={p.name} className={styles.face} />
          ))}
          {overflow > 0 && <span className={styles.overflow}>+{overflow}</span>}
        </span>
      )}
      <span className={`${styles.count} ${selected.length === 0 ? styles.empty : ''}`}>
        {selected.length} ready
      </span>
    </Link>
  )
}
