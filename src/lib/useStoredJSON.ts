import { useCallback, useRef, useSyncExternalStore } from 'react'

// Component-local state that persists across navigation via sessionStorage,
// AND syncs across multiple subscribers in the same tab. Built on
// useSyncExternalStore so React 18 concurrent rendering is happy.

type Listener = () => void

const cache = new Map<string, unknown>()
const listeners = new Map<string, Set<Listener>>()

const notify = (key: string) => {
  listeners.get(key)?.forEach((l) => l())
}

const readSnapshot = <T>(key: string, initial: T): T => {
  if (cache.has(key)) return cache.get(key) as T
  if (typeof window === 'undefined') return initial
  try {
    const raw = window.sessionStorage.getItem(key)
    const value = raw == null ? initial : (JSON.parse(raw) as T)
    cache.set(key, value)
    return value
  } catch {
    cache.set(key, initial)
    return initial
  }
}

export const useStoredJSON = <T>(key: string, initial: T) => {
  // Hold the latest `initial` in a ref so we can read it inside callbacks
  // without making them re-mount when callers pass a fresh object literal
  // every render (a common foot-gun that caused infinite update loops).
  const initialRef = useRef(initial)
  initialRef.current = initial

  const subscribe = useCallback(
    (cb: Listener) => {
      let set = listeners.get(key)
      if (!set) {
        set = new Set()
        listeners.set(key, set)
      }
      set.add(cb)
      return () => {
        set!.delete(cb)
      }
    },
    [key],
  )

  const value = useSyncExternalStore(
    subscribe,
    () => readSnapshot<T>(key, initialRef.current),
    () => initialRef.current,
  )

  const setValue = useCallback(
    (next: T | ((prev: T) => T)) => {
      const prev = readSnapshot<T>(key, initialRef.current)
      const resolved =
        typeof next === 'function' ? (next as (p: T) => T)(prev) : next
      cache.set(key, resolved)
      try {
        window.sessionStorage.setItem(key, JSON.stringify(resolved))
      } catch {
        // ignore — quota / private mode etc.
      }
      notify(key)
    },
    [key],
  )

  return [value, setValue] as const
}

// Test-only: clears the module-level cache + listener registry so that one
// test's stored values can't bleed into the next. Keep the export name
// underscored so it is obviously not part of the public API.
export const __resetForTests = () => {
  cache.clear()
  listeners.clear()
}
