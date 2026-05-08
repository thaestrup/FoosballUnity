import { act, render, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useStoredJSON } from './useStoredJSON'

// The module owns a process-wide `cache` Map keyed by string. We can't reach
// into it directly, so each test uses a unique key and clears sessionStorage
// to keep state isolated.
let keyCounter = 0
const uniqueKey = (label: string) => `${label}-${++keyCounter}-${Math.random()}`

beforeEach(() => {
  window.sessionStorage.clear()
})
afterEach(() => {
  window.sessionStorage.clear()
})

describe('useStoredJSON', () => {
  it('returns the seeded initial value when sessionStorage is empty', () => {
    const key = uniqueKey('initial-empty')
    const { result } = renderHook(() => useStoredJSON(key, { count: 7 }))
    expect(result.current[0]).toEqual({ count: 7 })
  })

  it('reads an existing sessionStorage value on mount', () => {
    const key = uniqueKey('preexisting')
    window.sessionStorage.setItem(key, JSON.stringify({ count: 99 }))
    const { result } = renderHook(() => useStoredJSON(key, { count: 0 }))
    expect(result.current[0]).toEqual({ count: 99 })
  })

  it('writes setter values back to sessionStorage', () => {
    const key = uniqueKey('write')
    const { result } = renderHook(() => useStoredJSON<{ n: number }>(key, { n: 1 }))
    act(() => {
      result.current[1]({ n: 42 })
    })
    expect(result.current[0]).toEqual({ n: 42 })
    expect(window.sessionStorage.getItem(key)).toBe(JSON.stringify({ n: 42 }))
  })

  it('supports functional updater form', () => {
    const key = uniqueKey('fn-updater')
    const { result } = renderHook(() => useStoredJSON<number>(key, 10))
    act(() => {
      result.current[1]((prev) => prev + 5)
    })
    expect(result.current[0]).toBe(15)
  })

  it('two component instances with the same key see updates from each other', () => {
    const key = uniqueKey('cross-subscriber')

    let aValue: number | undefined
    let bValue: number | undefined
    let setterFromA: ((next: number) => void) | undefined

    const A = () => {
      const [v, setV] = useStoredJSON<number>(key, 0)
      aValue = v
      setterFromA = setV
      return null
    }
    const B = () => {
      const [v] = useStoredJSON<number>(key, 0)
      bValue = v
      return null
    }

    render(<A />)
    render(<B />)

    expect(aValue).toBe(0)
    expect(bValue).toBe(0)

    act(() => {
      setterFromA!(123)
    })

    expect(aValue).toBe(123)
    expect(bValue).toBe(123)
  })

  it('keeps a stable setValue reference across renders even with a fresh initial literal', () => {
    const key = uniqueKey('stable-setter')

    // Each render passes a brand new object literal as initial — the
    // foot-gun the ref-based implementation defends against.
    const { result, rerender } = renderHook(() =>
      useStoredJSON<{ x: number }>(key, { x: 1 }),
    )
    const first = result.current[1]
    rerender()
    rerender()
    rerender()
    const last = result.current[1]
    expect(last).toBe(first)
  })

  it('falls back to the initial value when sessionStorage contains invalid JSON', () => {
    const key = uniqueKey('corrupt')
    window.sessionStorage.setItem(key, '{not json')
    const { result } = renderHook(() => useStoredJSON<number>(key, 7))
    expect(result.current[0]).toBe(7)
  })
})
