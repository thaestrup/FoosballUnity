/**
 * Helpers shared by contract tests.
 *
 * Contract tests hit a real backend instead of MSW. They are gated on
 * `VITE_CONTRACT_TESTS=1` so a regular `npm test` run skips them silently.
 *
 * Target base URL is controlled by `VITE_CONTRACT_BASE` (default
 * `http://localhost:5050`, the legacy Ratpack backend). Point it at
 * `http://localhost:5051` to run the same suite against the Quarkus port —
 * that's the parity gate from the consumer side.
 *
 * The default test setup (src/test-setup.ts) starts an MSW server with
 * `onUnhandledRequest: 'error'`, which would intercept and fail every real
 * fetch call. Rather than tearing the global server down (which conflicts
 * with the global `beforeAll` / `afterAll`), the contract suite registers
 * a `passthrough()` handler covering the configured base URL for the
 * duration of the suite. MSW lets matching requests fall through to the
 * real network.
 */
import { beforeEach } from 'vitest'
import { http, passthrough, ws } from 'msw'
import { server } from '@/test/server'

export const CONTRACT_BASE = process.env.VITE_CONTRACT_BASE ?? 'http://localhost:5050'

export const contractEnabled = process.env.VITE_CONTRACT_TESTS === '1'

/**
 * Tests should run when the env var is set. We don't probe the backend at
 * collection time — if it's unreachable, the individual fetch() calls will
 * fail with a clear network error, which is the right signal.
 */
export const shouldRunContract = contractEnabled

/**
 * Call inside a contract `describe(...)` block. Re-installs a wildcard
 * passthrough handler before every test so real fetch() calls hit the
 * live backend.
 *
 * Why beforeEach, not beforeAll: the global test-setup.ts registers
 * `afterEach(server.resetHandlers)` to keep MSW handler state from
 * leaking between tests. That reset clears our passthrough too, so
 * a `beforeAll` registration only survives the first test in each
 * file. `beforeEach` re-registers fresh per test.
 */
export const useLiveBackend = (): void => {
  beforeEach(() => {
    if (!shouldRunContract) return
    // Cover both the trailing-slash and no-slash forms by using two
    // wildcards. `http.all` matches every HTTP method.
    server.use(
      http.all(`${CONTRACT_BASE}/*`, () => passthrough()),
      http.all(`${CONTRACT_BASE}/*/*`, () => passthrough()),
    )
    // MSW intercepts WebSocket constructors globally. To let the timer
    // push test actually round-trip through the real backend, the WS
    // link's connection handler must:
    //  1. Call `server.connect()` to open a real WebSocket to the backend.
    //  2. Manually forward messages in both directions — MSW does NOT
    //     auto-bridge by default.
    const wsBase = CONTRACT_BASE.replace(/^http/, 'ws')
    server.use(
      ws.link(`${wsBase}/*`).addEventListener(
        'connection',
        ({ client, server: real }) => {
          real.connect()
          real.addEventListener('message', (event) => {
            const data = event.data
            // Forward to the mocked client. `data` is always string or
            // BufferLike from MSW.
            client.send(
              typeof data === 'string' ? data : new Uint8Array(data as ArrayBuffer),
            )
          })
          client.addEventListener('message', (event) => {
            const data = event.data
            real.send(
              typeof data === 'string' ? data : new Uint8Array(data as ArrayBuffer),
            )
          })
        },
      ),
    )
  })
}
