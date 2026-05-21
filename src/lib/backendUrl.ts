import { useSyncExternalStore } from 'react'

// Per-tab override of the API base URL. Stored in sessionStorage so it goes
// away when the tab closes — by design, so a stale override can't silently
// follow you across browser restarts.
const STORAGE_KEY = 'backendUrl:override'
const DEFAULT_URL =
  import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:5050'

type Listener = () => void
const listeners = new Set<Listener>()

const readOverride = (): string | null => {
  if (typeof window === 'undefined') return null
  try {
    return window.sessionStorage.getItem(STORAGE_KEY)
  } catch {
    return null
  }
}

const notify = () => {
  listeners.forEach((l) => l())
}

export const getBackendUrl = (): string => readOverride() ?? DEFAULT_URL
export const getBackendUrlDefault = (): string => DEFAULT_URL
export const isBackendUrlOverridden = (): boolean => readOverride() !== null

export const setBackendUrlOverride = (url: string): void => {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, url)
  } catch {
    // sessionStorage may be unavailable (private mode, quota); fall through
    // silently — caller already validated the URL.
  }
  notify()
}

export const clearBackendUrlOverride = (): void => {
  try {
    window.sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
  notify()
}

const subscribe = (cb: Listener): (() => void) => {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

export const useBackendUrl = () => {
  const url = useSyncExternalStore(subscribe, getBackendUrl, () => DEFAULT_URL)
  const overridden = useSyncExternalStore(
    subscribe,
    isBackendUrlOverridden,
    () => false,
  )
  return { url, overridden, defaultUrl: DEFAULT_URL }
}
