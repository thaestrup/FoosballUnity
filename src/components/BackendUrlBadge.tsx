import { useState, type FormEvent } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Dialog } from './Dialog'
import {
  clearBackendUrlOverride,
  setBackendUrlOverride,
  useBackendUrl,
} from '@/lib/backendUrl'
import styles from './BackendUrlBadge.module.css'

type Props = {
  variant?: 'chip' | 'inline'
}

export const BackendUrlBadge = ({ variant = 'chip' }: Props) => {
  const { url, overridden, defaultUrl } = useBackendUrl()
  const [open, setOpen] = useState(false)
  const qc = useQueryClient()

  const applyAndClose = () => {
    // Refetch active queries against the new URL so the UI updates without a
    // page reload.
    void qc.invalidateQueries()
    setOpen(false)
  }

  const onSave = (next: string) => {
    if (next === defaultUrl) {
      clearBackendUrlOverride()
    } else {
      setBackendUrlOverride(next)
    }
    applyAndClose()
  }

  const onReset = () => {
    clearBackendUrlOverride()
    applyAndClose()
  }

  return (
    <>
      <button
        type="button"
        className={`${styles.badge} ${styles[variant]} ${overridden ? styles.overridden : ''}`}
        onClick={() => setOpen(true)}
        title={overridden ? `${url} (override active)` : url}
      >
        <span className={styles.label}>API</span>
        <span className={styles.url}>{prettyUrl(url)}</span>
        {overridden && (
          <span
            className={styles.dot}
            aria-label="override active"
            role="status"
          />
        )}
      </button>

      <Dialog open={open} onClose={() => setOpen(false)} title="Backend URL">
        <Editor
          current={url}
          defaultUrl={defaultUrl}
          overridden={overridden}
          onSave={onSave}
          onReset={onReset}
          onCancel={() => setOpen(false)}
        />
      </Dialog>
    </>
  )
}

// Compact form for the chip: drop the protocol when http/https so "API
// localhost:5050" fits in less width without losing meaning.
const prettyUrl = (raw: string): string => {
  try {
    const u = new URL(raw)
    const tail = u.pathname === '/' ? '' : u.pathname
    return `${u.host}${tail}`
  } catch {
    return raw
  }
}

type EditorProps = {
  current: string
  defaultUrl: string
  overridden: boolean
  onSave: (next: string) => void
  onReset: () => void
  onCancel: () => void
}

const Editor = ({
  current,
  defaultUrl,
  overridden,
  onSave,
  onReset,
  onCancel,
}: EditorProps) => {
  const [value, setValue] = useState(current)
  const [error, setError] = useState<string | null>(null)

  const onSubmit = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = value.trim().replace(/\/+$/, '')
    const err = validate(trimmed)
    if (err) {
      setError(err)
      return
    }
    onSave(trimmed)
  }

  return (
    <form className={styles.form} onSubmit={onSubmit}>
      <p className={styles.help}>
        Default: <code>{defaultUrl}</code>
        {overridden && (
          <span className={styles.muted}>
            {' '}
            — currently overridden for this tab.
          </span>
        )}
      </p>
      <label className={styles.field}>
        <span className={styles.fieldLabel}>API URL</span>
        <input
          type="text"
          className={styles.input}
          value={value}
          onChange={(e) => {
            setValue(e.target.value)
            setError(null)
          }}
          spellCheck={false}
          autoFocus
        />
      </label>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <p className={styles.note}>
        Override only applies to this tab and clears when the tab closes. After
        saving, all queries refetch against the new URL.
      </p>
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.secondary}
          onClick={onCancel}
        >
          Cancel
        </button>
        {overridden && (
          <button
            type="button"
            className={styles.secondary}
            onClick={onReset}
          >
            Reset to default
          </button>
        )}
        <button type="submit" className={styles.primary}>
          Save
        </button>
      </div>
    </form>
  )
}

const validate = (v: string): string | null => {
  if (!v) return 'Enter a URL.'
  let parsed: URL
  try {
    parsed = new URL(v)
  } catch {
    return 'Not a valid URL.'
  }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return 'Use http:// or https://'
  }
  return null
}
