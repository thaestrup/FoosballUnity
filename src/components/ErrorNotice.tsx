import { NetworkError } from '@/lib/api'
import { BackendUrlBadge } from './BackendUrlBadge'
import styles from './ErrorNotice.module.css'

type Props = {
  // Used to render "Couldn't load {what}" when no explicit title is given.
  what?: string
  // Overrides the default heading entirely (use for non-load contexts).
  title?: string
  error: Error
  onRetry?: () => void
}

export const ErrorNotice = ({ what, title, error, onRetry }: Props) => {
  const heading =
    title ?? (what ? `Couldn't load ${what}` : 'Something went wrong')
  const isNetwork = error instanceof NetworkError
  const detail = isNetwork
    ? "The backend isn't responding. Make sure it's running, then try again."
    : error.message

  return (
    <div role="alert" className={styles.notice}>
      <div className={styles.body}>
        <strong className={styles.heading}>{heading}</strong>
        <span className={styles.detail}>{detail}</span>
        {isNetwork && <BackendUrlBadge variant="inline" />}
      </div>
      {onRetry && (
        <button type="button" className={styles.retry} onClick={onRetry}>
          Retry
        </button>
      )}
    </div>
  )
}
