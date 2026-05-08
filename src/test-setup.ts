import '@testing-library/jest-dom/vitest'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from './test/server'
import { __resetForTests as resetStoredJSON } from './lib/useStoredJSON'

// Node 25 ships a stub `globalThis.localStorage`/`sessionStorage` that
// shadows jsdom's implementation but lacks `clear`, `setItem`, etc. Replace
// both with a Map-backed Storage shim so component code and tests can rely on
// the standard Web Storage API.
const installStorageShim = (name: 'localStorage' | 'sessionStorage') => {
  const store = new Map<string, string>()
  const shim = {
    get length() {
      return store.size
    },
    key(i: number) {
      return Array.from(store.keys())[i] ?? null
    },
    getItem(k: string) {
      return store.has(k) ? (store.get(k) as string) : null
    },
    setItem(k: string, v: string) {
      store.set(k, String(v))
    },
    removeItem(k: string) {
      store.delete(k)
    },
    clear() {
      store.clear()
    },
  } as Storage
  Object.defineProperty(window, name, { configurable: true, value: shim })
  Object.defineProperty(globalThis, name, { configurable: true, value: shim })
}

if (typeof window.localStorage?.clear !== 'function') installStorageShim('localStorage')
if (typeof window.sessionStorage?.clear !== 'function') installStorageShim('sessionStorage')

beforeAll(() => server.listen({ onUnhandledRequest: 'error' }))
afterEach(() => {
  server.resetHandlers()
  resetStoredJSON()
  if (typeof window !== 'undefined') window.sessionStorage.clear()
})
afterAll(() => server.close())
