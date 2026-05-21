import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearBackendUrlOverride,
  getBackendUrl,
  getBackendUrlDefault,
  isBackendUrlOverridden,
  setBackendUrlOverride,
} from './backendUrl'

beforeEach(() => {
  window.sessionStorage.clear()
})

afterEach(() => {
  window.sessionStorage.clear()
})

describe('backendUrl store', () => {
  it('returns the env default when no override is set', () => {
    expect(getBackendUrl()).toBe(getBackendUrlDefault())
    expect(isBackendUrlOverridden()).toBe(false)
  })

  it('returns the override after setBackendUrlOverride', () => {
    setBackendUrlOverride('http://example.test:9000')
    expect(getBackendUrl()).toBe('http://example.test:9000')
    expect(isBackendUrlOverridden()).toBe(true)
  })

  it('clears the override on clearBackendUrlOverride', () => {
    setBackendUrlOverride('http://example.test:9000')
    expect(isBackendUrlOverridden()).toBe(true)
    clearBackendUrlOverride()
    expect(isBackendUrlOverridden()).toBe(false)
    expect(getBackendUrl()).toBe(getBackendUrlDefault())
  })

  it('persists the override via sessionStorage', () => {
    setBackendUrlOverride('http://other.test:1234')
    expect(window.sessionStorage.getItem('backendUrl:override')).toBe(
      'http://other.test:1234',
    )
  })

  it('survives sessionStorage being inaccessible (no throw)', () => {
    const spy = vi
      .spyOn(window.sessionStorage, 'setItem')
      .mockImplementation(() => {
        throw new Error('quota')
      })
    expect(() => setBackendUrlOverride('http://nope.test')).not.toThrow()
    spy.mockRestore()
  })
})
