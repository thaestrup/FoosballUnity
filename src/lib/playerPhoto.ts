import { useSyncExternalStore } from 'react'
import { getBackendUrl } from './backendUrl'

// Per-name cache-bust counter. The backend serves player photos with
// `Cache-Control: private, max-age=60`, so without a query-string version
// the browser would keep showing the previous photo for up to a minute
// after an upload or delete. Bumping the counter after a mutation forces
// every <Avatar name={name}> currently mounted to refetch.
const versions = new Map<string, number>()
const listeners = new Map<string, Set<() => void>>()

const getVersion = (name: string): number => versions.get(name) ?? 0

const notify = (name: string) => {
  listeners.get(name)?.forEach((l) => l())
}

export const playerPhotoUrl = (name: string): string =>
  `${getBackendUrl()}/players/${encodeURIComponent(name)}/photo`

export const bumpPhotoVersion = (name: string): void => {
  versions.set(name, getVersion(name) + 1)
  notify(name)
}

const subscribe = (name: string) => (cb: () => void): (() => void) => {
  let set = listeners.get(name)
  if (!set) {
    set = new Set()
    listeners.set(name, set)
  }
  set.add(cb)
  return () => {
    set!.delete(cb)
  }
}

export const usePhotoVersion = (name: string): number =>
  useSyncExternalStore(
    subscribe(name),
    () => getVersion(name),
    () => 0,
  )

// Test-only: clears the version map + listener registry so one test's
// bumps don't bleed into the next. Mirrors __resetForTests in useStoredJSON.
export const __resetPhotoVersionsForTests = (): void => {
  versions.clear()
  listeners.clear()
}
