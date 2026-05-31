import { useEffect, useId, useRef, type ReactNode } from 'react'
import styles from './Dialog.module.css'

type Props = {
  open: boolean
  onClose: () => void
  title?: string
  children: ReactNode
}

export const Dialog = ({ open, onClose, title, children }: Props) => {
  const ref = useRef<HTMLDialogElement>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    // jsdom and older browsers ship <dialog> without showModal/close; fall back
    // to toggling the `open` attribute so the element still renders.
    if (open && !dialog.open) {
      if (typeof dialog.showModal === 'function') dialog.showModal()
      else dialog.setAttribute('open', '')
    }
    if (!open && dialog.open) {
      if (typeof dialog.close === 'function') dialog.close()
      else dialog.removeAttribute('open')
    }
  }, [open])

  // Close when the backdrop (the dialog element itself, not its inner box) is clicked.
  const handleClick = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === ref.current) onClose()
  }

  return (
    <dialog
      ref={ref}
      className={styles.dialog}
      onClose={onClose}
      onClick={handleClick}
      aria-labelledby={title ? titleId : undefined}
    >
      <div className={styles.content}>
        <header className={styles.header}>
          {title && (
            <h2 id={titleId} className={styles.title}>
              {title}
            </h2>
          )}
          <button
            type="button"
            onClick={onClose}
            className={styles.close}
            aria-label="Close"
          >
            ×
          </button>
        </header>
        <div className={styles.body}>{children}</div>
      </div>
    </dialog>
  )
}
