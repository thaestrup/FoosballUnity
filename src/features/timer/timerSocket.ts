import { useEffect, useRef, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { httpToWsUrl, useBackendUrl } from '@/lib/backendUrl'
import { TimerActionSchema } from './timer'
import { timerQuery } from './useTimer'

const GRACE_MS = 3_000
const RECONNECT_BASE_MS = 500
const RECONNECT_CAP_MS = 10_000
const RECONNECT_JITTER_MS = 250
const POLL_MS = 1_000

// Drives the timer query cache from a server-pushed WebSocket. If the WS
// can't open within GRACE_MS, falls back to the legacy 1 Hz polling so the
// timer keeps working on networks that block WS upgrades silently.
//
// Mount once at the root (see TimerSubscription in routes/__root.tsx).
// Consumers (HeaderTimer, Countdown) keep using useTimer() and read from
// the same query cache — they don't care whether updates arrived via push
// or poll. Re-keys on backend URL changes so the BackendUrlBadge editor
// re-opens the socket against the new host.
export const useTimerSocket = () => {
  const { url: backendUrl } = useBackendUrl()
  const qc = useQueryClient()
  const [wsLive, setWsLive] = useState(false)
  const [graceExpired, setGraceExpired] = useState(false)
  const attemptsRef = useRef(0)

  useEffect(() => {
    setWsLive(false)
    setGraceExpired(false)
    attemptsRef.current = 0

    // Some runtimes (older Node, certain test setups) don't ship the
    // WebSocket constructor. Skip the WS path entirely and let polling
    // take over after the grace window.
    if (typeof globalThis.WebSocket !== 'function') {
      const t = setTimeout(() => setGraceExpired(true), GRACE_MS)
      return () => clearTimeout(t)
    }

    const wsUrl = `${httpToWsUrl(backendUrl)}/ws/timer`
    let socket: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null
    let cancelled = false

    const connect = () => {
      if (cancelled) return
      try {
        socket = new WebSocket(wsUrl)
      } catch {
        scheduleReconnect()
        return
      }

      socket.addEventListener('open', () => {
        if (cancelled) return
        attemptsRef.current = 0
        setWsLive(true)
      })

      socket.addEventListener('message', (e: MessageEvent) => {
        if (cancelled) return
        try {
          const raw = typeof e.data === 'string' ? e.data : ''
          const dto = TimerActionSchema.parse(JSON.parse(raw))
          qc.setQueryData(timerQuery.queryKey, dto)
        } catch {
          // Malformed frame — backend contract pins the shape, so drop it
          // silently. Don't break the subscription over one bad message.
        }
      })

      socket.addEventListener('close', () => {
        if (cancelled) return
        setWsLive(false)
        scheduleReconnect()
      })

      // 'error' always precedes 'close' for a failed handshake, so the
      // close handler covers the retry path. Adding both would
      // double-schedule.
    }

    const scheduleReconnect = () => {
      if (cancelled) return
      attemptsRef.current += 1
      const backoff = Math.min(
        RECONNECT_BASE_MS * 2 ** (attemptsRef.current - 1),
        RECONNECT_CAP_MS,
      )
      const jitter = Math.random() * RECONNECT_JITTER_MS
      reconnectTimer = setTimeout(connect, backoff + jitter)
    }

    const graceTimer = setTimeout(() => setGraceExpired(true), GRACE_MS)
    connect()

    return () => {
      cancelled = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      clearTimeout(graceTimer)
      if (socket) socket.close()
    }
  }, [backendUrl, qc])

  // Polling fallback. Only kicks in after the grace window expires AND
  // when the WS isn't live — so the happy WS path makes zero polling
  // requests. If the WS dies later, polling resumes immediately until the
  // next 'open' event flips wsLive back on.
  useQuery({
    ...timerQuery,
    refetchInterval: !wsLive && graceExpired ? POLL_MS : false,
    refetchIntervalInBackground: false,
  })

  return { wsLive }
}
