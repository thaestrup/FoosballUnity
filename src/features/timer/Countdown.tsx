import { useEffect, useMemo, useState } from 'react'
import { useStoredJSON } from '@/lib/useStoredJSON'
import { useResetTimer, useTimer } from './useTimer'
import { formatMmSs } from './timer'
import styles from './Countdown.module.css'

const DURATION_OPTIONS = [30, 60, 120] as const
const DEFAULT_DURATION_SEC = 120

const DUKE_COUNT = 8

export const Countdown = () => {
  const { data: timer, isPending, error } = useTimer()
  const reset = useResetTimer()
  const [duration, setDuration] = useStoredJSON<number>(
    'timer:duration',
    DEFAULT_DURATION_SEC,
  )
  const [now, setNow] = useState(() => Date.now())

  // The backend's `lastRequestedTimerStart` is in a broken timezone (see FINDINGS),
  // so absolute-time math against it is unreliable. Treat it purely as a change
  // detection key: when its value differs from the last value we tracked, somebody
  // (us or another client) hit Reset, so we (re)start a local stopwatch.
  // Persist {trackedKey, resetAt, started} so the countdown keeps ticking when
  // navigating between routes (the component unmounts on each navigation).
  const [trackedKey, setTrackedKey] = useStoredJSON<string | null>(
    'timer:trackedKey',
    null,
  )
  const [started, setStarted] = useStoredJSON<boolean>('timer:started', false)
  const [resetAt, setResetAt] = useStoredJSON<number>('timer:resetAt', 0)

  useEffect(() => {
    if (!timer) return
    if (trackedKey === null) {
      // First time we see a timer — track its current value but don't start.
      setTrackedKey(timer.lastRequestedTimerStart)
      return
    }
    if (timer.lastRequestedTimerStart !== trackedKey) {
      // Server reset detected (us or another client) — start the local stopwatch.
      setTrackedKey(timer.lastRequestedTimerStart)
      setResetAt(Date.now())
      setStarted(true)
    }
  }, [timer, trackedKey, setTrackedKey, setResetAt, setStarted])

  // Local clock tick so the display advances between server polls.
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [])

  const elapsed = started ? Math.max(0, Math.floor((now - resetAt) / 1000)) : 0
  const remaining = duration - elapsed
  const displayRemaining = started ? Math.max(0, remaining) : duration

  // Pre-create the Duke samples once. Picked at random per Reset click for
  // variety. Threshold sounds (1min/30s/15s/finish) live on `HeaderTimer`,
  // which is always mounted, so they fire across route changes.
  const dukeAudios = useMemo(() => {
    return Array.from({ length: DUKE_COUNT }, (_, i) => {
      const a = new Audio(`/sounds/duke/${i + 1}.wav`)
      a.preload = 'auto'
      a.load()
      return a
    })
  }, [])

  // Plays a randomly-picked Duke sample on Reset click. The click is also a
  // user gesture that unlocks subsequent programmatic playback of the
  // threshold audios in HeaderTimer.
  const onResetClick = () => {
    if (dukeAudios.length > 0) {
      const idx = Math.floor(Math.random() * dukeAudios.length)
      const audio = dukeAudios[idx]
      audio.currentTime = 0
      void audio.play().catch(() => {
        /* autoplay blocked — ignore */
      })
    }
    reset.mutate()
  }

  if (isPending) return <p className={styles.muted}>Loading timer…</p>
  if (error) return <p className={styles.error}>Failed to load timer: {error.message}</p>

  const isFinished = started && remaining <= 0
  const phase = !started
    ? 'normal'
    : remaining <= 15
      ? 'critical'
      : remaining <= 60
        ? 'warning'
        : 'normal'

  return (
    <div className={styles.wrapper}>
      <div className={`${styles.display} ${styles[phase]} ${isFinished ? styles.finished : ''}`}>
        <span className={styles.time}>{formatMmSs(displayRemaining)}</span>
        <span className={styles.label}>
          {!started ? 'ready' : isFinished ? "Time's up" : displayRemaining <= 60 ? 'remaining' : 'left'}
        </span>
      </div>

      <div className={styles.controls}>
        <button
          type="button"
          className={styles.primary}
          onClick={onResetClick}
          disabled={reset.isPending}
        >
          {reset.isPending ? 'Resetting…' : 'Start / Reset'}
        </button>
        <label className={styles.field}>
          <span>Duration</span>
          <select
            className={styles.select}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          >
            {DURATION_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s} s
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
}
