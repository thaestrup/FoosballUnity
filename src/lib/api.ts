const BASE = import.meta.env.VITE_BACKEND_URL ?? 'http://localhost:5050'

export class ApiError extends Error {
  readonly status: number

  constructor(message: string, status: number) {
    super(message)
    this.name = 'ApiError'
    this.status = status
  }
}

export const api = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...init?.headers },
  })
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
