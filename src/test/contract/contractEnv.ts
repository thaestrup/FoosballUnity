/**
 * Helpers shared by contract tests.
 *
 * Contract tests hit a real backend at `http://localhost:5050` instead of MSW.
 * They are gated on `VITE_CONTRACT_TESTS=1` so a regular `npm test` run skips
 * them silently.
 *
 * The default test setup (src/test-setup.ts) starts an MSW server with
 * `onUnhandledRequest: 'error'`, which would intercept and fail every real
 * fetch call. Rather than tearing the global server down (which conflicts
 * with the global `beforeAll` / `afterAll`), the contract suite registers
 * a `passthrough()` handler covering `http://localhost:5050/*` for the
 * duration of the suite. MSW lets matching requests fall through to the
 * real network.
 */
import { afterAll, beforeAll } from 'vitest'
import { http, passthrough } from 'msw'
import { server } from '@/test/server'

export const CONTRACT_BASE = 'http://localhost:5050'

export const contractEnabled = process.env.VITE_CONTRACT_TESTS === '1'

/**
 * Tests should run when the env var is set. We don't probe the backend at
 * collection time — if it's unreachable, the individual fetch() calls will
 * fail with a clear network error, which is the right signal.
 */
export const shouldRunContract = contractEnabled

/**
 * Call inside a contract `describe(...)` block. Installs a wildcard
 * passthrough handler so real fetch() calls hit the live backend, then
 * resets handlers when the suite finishes (the global afterEach already
 * resets per-test, but afterAll guarantees other suites in the same file
 * see clean state).
 */
export const useLiveBackend = (): void => {
  beforeAll(() => {
    if (!shouldRunContract) return
    // Cover both the trailing-slash and no-slash forms by using two
    // wildcards. `http.all` matches every HTTP method.
    server.use(
      http.all(`${CONTRACT_BASE}/*`, () => passthrough()),
      http.all(`${CONTRACT_BASE}/*/*`, () => passthrough()),
    )
  })

  afterAll(() => {
    if (!shouldRunContract) return
    server.resetHandlers()
  })
}
