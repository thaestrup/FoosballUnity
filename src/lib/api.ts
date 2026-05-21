import { getBackendUrl } from './backendUrl'

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

// Thrown when fetch itself fails (offline, DNS, connection refused, CORS) —
// distinct from a backend response we successfully received. ErrorNotice
// special-cases this with friendlier copy than the raw "Failed to fetch".
export class NetworkError extends Error {
  constructor() {
    super('Backend is not responding')
    this.name = 'NetworkError'
  }
}

export const api = async <T>(path: string, init?: RequestInit): Promise<T> => {
  let res: Response
  try {
    // Resolve per-request so a runtime override (from the Backend URL editor)
    // applies to the next call without a page reload.
    res = await fetch(`${getBackendUrl()}${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...init?.headers },
    })
  } catch {
    // fetch() rejects (vs. resolving with !res.ok) only on transport failure.
    throw new NetworkError()
  }
  if (!res.ok) {
    throw new ApiError(`${init?.method ?? 'GET'} ${path} → ${res.status}`, res.status)
  }
  // The Ratpack backend returns JSON for GETs but plain text for write ops
  // (e.g. "insertPlayer: Foo, result: 88"). Accept either.
  const text = await res.text()
  if (!text) return null as T
  try {
    return JSON.parse(text) as T
  } catch {
    return text as T
  }
}
