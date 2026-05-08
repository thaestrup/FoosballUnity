import { act, renderHook } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useTheme } from './useTheme'

beforeEach(() => {
  delete document.documentElement.dataset.theme
  window.localStorage.clear()
})
afterEach(() => {
  delete document.documentElement.dataset.theme
  window.localStorage.clear()
})

describe('useTheme', () => {
  it('defaults to "light" when no data-theme attr is set', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current[0]).toBe('light')
  })

  it('initialises from data-theme="dark"', () => {
    document.documentElement.dataset.theme = 'dark'
    const { result } = renderHook(() => useTheme())
    expect(result.current[0]).toBe('dark')
  })

  it('initialises from data-theme="light"', () => {
    document.documentElement.dataset.theme = 'light'
    const { result } = renderHook(() => useTheme())
    expect(result.current[0]).toBe('light')
  })

  it('falls back to "light" for an unknown data-theme value', () => {
    document.documentElement.dataset.theme = 'mystery'
    const { result } = renderHook(() => useTheme())
    expect(result.current[0]).toBe('light')
  })

  it('writes the theme to localStorage on change', () => {
    const { result } = renderHook(() => useTheme())
    expect(window.localStorage.getItem('theme')).toBe('light')
    act(() => {
      result.current[1]('dark')
    })
    expect(result.current[0]).toBe('dark')
    expect(window.localStorage.getItem('theme')).toBe('dark')
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('toggle flips light → dark → light', () => {
    const { result } = renderHook(() => useTheme())
    expect(result.current[0]).toBe('light')
    act(() => {
      result.current[2]()
    })
    expect(result.current[0]).toBe('dark')
    act(() => {
      result.current[2]()
    })
    expect(result.current[0]).toBe('light')
  })

  it('toggle starting from dark flips to light', () => {
    document.documentElement.dataset.theme = 'dark'
    const { result } = renderHook(() => useTheme())
    expect(result.current[0]).toBe('dark')
    act(() => {
      result.current[2]()
    })
    expect(result.current[0]).toBe('light')
    expect(window.localStorage.getItem('theme')).toBe('light')
    expect(document.documentElement.dataset.theme).toBe('light')
  })
})
