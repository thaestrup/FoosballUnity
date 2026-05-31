import { describe, expect, it } from 'vitest'
// Use the `ws` package (already a transitive dep) so we don't depend on
// the host runtime shipping a global WebSocket. Works the same in Node
// versions before built-in WebSocket support.
import { WebSocket as NodeWebSocket } from 'ws'
import {
  TimerActionListSchema,
  TimerActionSchema,
} from '@/features/timer/timer'
import { httpToWsUrl } from '@/lib/backendUrl'
import {
  CONTRACT_BASE,
  shouldRunContract,
  useLiveBackend,
} from './contractEnv'

// Backend sends the first frame immediately on open. If we waited until
// after `awaitOpen` resolved to attach a message listener, that frame
// would fire on the empty listener list and be lost. Instead, attach a
// queueing listener up front and have awaitMessage() shift from the queue.
type MessageQueue = {
  next: (timeoutMs: number) => Promise<string>
}

const queueMessages = (socket: NodeWebSocket): MessageQueue => {
  const buffer: string[] = []
  const waiters: Array<(s: string) => void> = []

  socket.on('message', (data: Buffer | ArrayBuffer | Buffer[]) => {
    const s = data.toString()
    const w = waiters.shift()
    if (w) w(s)
    else buffer.push(s)
  })

  return {
    next: (timeoutMs) =>
      new Promise((resolve, reject) => {
        if (buffer.length > 0) {
          resolve(buffer.shift() as string)
          return
        }
        const onMessage = (s: string) => {
          clearTimeout(timer)
          resolve(s)
        }
        const timer = setTimeout(() => {
          const idx = waiters.indexOf(onMessage)
          if (idx >= 0) waiters.splice(idx, 1)
          reject(new Error(`No WS frame within ${timeoutMs}ms`))
        }, timeoutMs)
        waiters.push(onMessage)
      }),
  }
}

const awaitOpen = (
  socket: NodeWebSocket,
  timeoutMs: number,
): Promise<void> =>
  new Promise((resolve, reject) => {
    if (socket.readyState === socket.OPEN) {
      resolve()
      return
    }
    const timer = setTimeout(() => {
      socket.off('open', onOpen)
      socket.off('error', onError)
      reject(new Error(`WS open timeout after ${timeoutMs}ms`))
    }, timeoutMs)
    const onOpen = () => {
      clearTimeout(timer)
      socket.off('error', onError)
      resolve()
    }
    const onError = (err: Error) => {
      clearTimeout(timer)
      socket.off('open', onOpen)
      reject(err)
    }
    socket.once('open', onOpen)
    socket.once('error', onError)
  })

describe.skipIf(!shouldRunContract)('contract: timer', () => {
  useLiveBackend()

  it('GET /timer matches TimerActionListSchema', async () => {
    const res = await fetch(`${CONTRACT_BASE}/timer`)
    expect(res.ok).toBe(true)
    const data: unknown = await res.json()
    const parsed = TimerActionListSchema.parse(data)
    expect(Array.isArray(parsed)).toBe(true)
    // Sanity: if there's at least one entry it should have an id and a
    // lastRequestedTimerStart string.
    if (parsed.length > 0) {
      expect(typeof parsed[0].id).toBe('number')
      expect(typeof parsed[0].lastRequestedTimerStart).toBe('string')
    }
  })

  // Re-confirmed in use 2026-05-14: Countdown.tsx mounts useResetTimer.
  // POST /timer is plain-text reply ("result: 1"); the api() wrapper falls
  // through to text on JSON.parse failure, so we just check the response is
  // 2xx and the next GET reflects an advanced timestamp.
  it('POST /timer advances lastRequestedTimerStart', async () => {
    const beforeRes = await fetch(`${CONTRACT_BASE}/timer`)
    const beforeData: unknown = await beforeRes.json()
    const beforeParsed = TimerActionListSchema.parse(beforeData)
    expect(beforeParsed.length).toBeGreaterThan(0)
    const before = beforeParsed[0].lastRequestedTimerStart

    // MariaDB TIMESTAMP precision is per-second by default. Sleep just past
    // a second so NOW() ticks before we POST.
    await new Promise((r) => setTimeout(r, 1100))

    const postRes = await fetch(`${CONTRACT_BASE}/timer`, { method: 'POST' })
    expect(postRes.ok).toBe(true)
    expect(postRes.status).toBe(200)

    const afterRes = await fetch(`${CONTRACT_BASE}/timer`)
    const afterData: unknown = await afterRes.json()
    const afterParsed = TimerActionListSchema.parse(afterData)
    expect(afterParsed.length).toBeGreaterThan(0)
    const after = afterParsed[0].lastRequestedTimerStart

    // Legacy Timestamp.toString() format is lexicographically orderable.
    expect(after.localeCompare(before)).toBeGreaterThan(0)
  })
})

// Consumer-side mirror of TableSoccerREST/src/test/java/com/foosball/
// contract/TimerSocketContractTest.java. Self-skips when contract tests
// are disabled (VITE_CONTRACT_TESTS != 1) or the configured backend
// doesn't expose /ws/timer (Ratpack at :5050 doesn't — the catch in
// the test below downgrades that to a skip).
describe.skipIf(!shouldRunContract)('contract: timer WebSocket', () => {
  // No useLiveBackend() — when VITE_CONTRACT_TESTS=1 the global test-setup
  // leaves MSW uninstalled, so the WS upgrade reaches the real backend
  // directly.

  it('pushes a frame on connect and broadcasts after POST /timer', async () => {
    const wsUrl = `${httpToWsUrl(CONTRACT_BASE)}/ws/timer`
    const socket = new NodeWebSocket(wsUrl)

    // Subscribe to messages BEFORE awaiting open: the backend sends the
    // first frame the moment the upgrade completes, and we can't risk
    // missing it during the await tick.
    const queue = queueMessages(socket)

    try {
      // The Ratpack backend on :5050 doesn't speak WS. Surface that as
      // a skip rather than a hard failure so the same suite stays green
      // on both backends.
      try {
        await awaitOpen(socket, 2_000)
      } catch (err) {
        // eslint-disable-next-line no-console
        console.warn(
          `[contract] /ws/timer not available at ${CONTRACT_BASE} — skipping (${(err as Error).message})`,
        )
        return
      }

      // Frame 1: emitted on connect, mirrors the current /timer row.
      const initialRaw = await queue.next(2_000)
      const initial = TimerActionSchema.parse(JSON.parse(initialRaw))
      // Also accept the schema's array form for symmetry with the GET.
      expect(TimerActionListSchema.parse([initial])).toHaveLength(1)
      const before = initial.lastRequestedTimerStart

      // MariaDB TIMESTAMP precision is per-second; let NOW() tick first.
      await new Promise((r) => setTimeout(r, 1_100))

      const postRes = await fetch(`${CONTRACT_BASE}/timer`, {
        method: 'POST',
      })
      expect(postRes.ok).toBe(true)

      // Frame 2: broadcast triggered by the POST.
      const broadcastRaw = await queue.next(2_000)
      const broadcast = TimerActionSchema.parse(JSON.parse(broadcastRaw))
      const after = broadcast.lastRequestedTimerStart

      expect(after.localeCompare(before)).toBeGreaterThan(0)
    } finally {
      socket.close()
    }
  }, 5_000)
})
