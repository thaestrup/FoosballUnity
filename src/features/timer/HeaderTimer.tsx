import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useStoredJSON } from '@/lib/useStoredJSON'
import { useTimer } from './useTimer'
import { formatMmSs } from './timer'
import styles from './HeaderTimer.module.css'

const DEFAULT_DURATION_SEC = 120

const SOUND_THRESHOLDS: Array<{ atRemaining: number; src: string }> = [
  { atRemaining: 60, src: '/sounds/1minute.wav' },
  { atRemaining: 30, src: '/sounds/30seconds.wav' },
  { atRemaining: 15, src: '/sounds/15seconds.wav' },
  { atRemaining: 0, src: '/sounds/finish.wav' },
]

export const HeaderTimer = () => {
  const { data: timer } = useTimer()
  const [trackedKey, setTrackedKey] = useStoredJSON<string | null>(
    'timer:trackedKey',
    null,
  )
  const [started, setStarted] = useStoredJSON<boolean>('timer:started', false)
  const [resetAt, setResetAt] = useStoredJSON<number>('timer:resetAt', 0)
  const [duration] = useStoredJSON<number>('timer:duration', DEFAULT_DURATION_SEC)

  // Pre-load threshold audios once. Cloned per play to avoid mid-play state.
  const thresholdAudios = useMemo(() => {
    const m = new Map<number, HTMLAudioElement>()
    for (const t of SOUND_THRESHOLDS) {
      const a = new Audio(t.src)
      a.preload = 'auto'
      a.load()
      m.set(t.atRemaining, a)
    }
    return m
  }, [])

  // Mirror the change-detection logic from Countdown — idempotent across
  // components since useStoredJSON is subscribable; whichever sees the change
  // first writes, the others observe and skip.
  useEffect(() => {
    if (!timer) return
    if (trackedKey === null) {
      setTrackedKey(timer.lastRequestedTimerStart)
      return
    }
    if (timer.lastRequestedTimerStart !== trackedKey) {
      setTrackedKey(timer.lastRequestedTimerStart)
      setResetAt(Date.now())
      setStarted(true)
    }
  }, [timer, trackedKey, setTrackedKey, setResetAt, setStarted])

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!started) return
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [started])

  // Compute remaining BEFORE the early return so the threshold-sound effect
  // below can depend on it. (When stopped, remaining stays at `duration` so
  // no thresholds fire.)
  const elapsed = started ? Math.max(0, Math.floor((now - resetAt) / 1000)) : 0
  const remaining = Math.max(0, duration - elapsed)
  const remainingForThresholds = started ? duration - elapsed : duration

  // Fire threshold sounds when `remaining` actually crosses a threshold during
  // the running cycle. This component lives in the root layout so it survives
  // route changes — sounds fire even if the user is on /games or /players.
  const prevRemainingRef = useRef<number | null>(null)

  useEffect(() => {
    if (!started) {
      prevRemainingRef.current = remainingForThresholds
      return
    }
    const prev = prevRemainingRef.current
    if (prev != null) {
      for (const t of SOUND_THRESHOLDS) {
        if (prev > t.atRemaining && remainingForThresholds <= t.atRemaining) {
          const source = thresholdAudios.get(t.atRemaining)
          if (source) {
            const clone = source.cloneNode(true) as HTMLAudioElement
            void clone.play().catch(() => {
              /* autoplay blocked — ignore */
            })
          }
        }
      }
    }
    prevRemainingRef.current = remainingForThresholds
  }, [remainingForThresholds, started, thresholdAudios])

  if (!started) return null
  const isFinished = remaining <= 0
  const phase = isFinished
    ? 'finished'
    : remaining <= 15
      ? 'critical'
      : remaining <= 60
        ? 'warning'
        : 'normal'

  return (
    <Link
      to="/tournament"
      className={`${styles.link} ${styles[phase]}`}
      title={isFinished ? 'Time up — tap to go to the tournament' : 'Match timer — tap for details'}
    >
      <span className={styles.dot} aria-hidden="true" />
      <span className={styles.time}>{formatMmSs(remaining)}</span>
    </Link>
  )
}
