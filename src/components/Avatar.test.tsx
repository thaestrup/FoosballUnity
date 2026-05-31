import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { Avatar } from './Avatar'
import {
  __resetPhotoVersionsForTests,
  bumpPhotoVersion,
} from '@/lib/playerPhoto'

beforeEach(() => {
  __resetPhotoVersionsForTests()
})

afterEach(() => {
  __resetPhotoVersionsForTests()
})

describe('Avatar', () => {
  it('renders an <img> pointing at the backend photo endpoint', () => {
    const { container } = render(<Avatar name="Lars" />)
    const img = container.querySelector('img')!
    expect(img.src).toContain('/players/Lars/photo')
  })

  it('includes a cache-busting ?v= query parameter', () => {
    const { container } = render(<Avatar name="Lars" />)
    const img = container.querySelector('img')!
    expect(img.src).toMatch(/[?&]v=\d+$/)
  })

  it('encodes the name for URL safety', () => {
    const { container } = render(<Avatar name="John Doe" />)
    const img = container.querySelector('img')!
    expect(img.src).toContain('/players/John%20Doe/photo')
  })

  it('falls back to the inline DefaultAvatar SVG when the image errors', () => {
    const { container } = render(<Avatar name="Stranger" />)
    const img = container.querySelector('img')!
    fireEvent.error(img)
    // After onError, the <img> is replaced by the silhouette SVG which
    // exposes role="img" and the "No photo" accessible name.
    expect(screen.getByRole('img', { name: /no photo/i })).toBeInTheDocument()
    expect(container.querySelector('img:not([role])')).toBeNull()
  })

  it('resets the errored fallback when the name prop changes', () => {
    const { container, rerender } = render(<Avatar name="Stranger" />)
    fireEvent.error(container.querySelector('img')!)
    expect(screen.queryByRole('img', { name: /no photo/i })).toBeInTheDocument()

    rerender(<Avatar name="Famous" />)
    // New name -> fresh <img>, silhouette gone until that one also errors.
    expect(container.querySelector('img')).not.toBeNull()
    expect(screen.queryByRole('img', { name: /no photo/i })).toBeNull()
  })

  it('updates the src after bumpPhotoVersion is called', () => {
    const { container } = render(<Avatar name="Lars" />)
    const initialSrc = container.querySelector('img')!.src
    // Wrap in act() so useSyncExternalStore's re-render flushes before
    // we read the next src value.
    act(() => {
      bumpPhotoVersion('Lars')
    })
    const nextSrc = container.querySelector('img')!.src
    expect(nextSrc).not.toBe(initialSrc)
    expect(nextSrc).toContain('/players/Lars/photo')
  })

  it("ignores version bumps for a different player's photo", () => {
    const { container } = render(<Avatar name="Lars" />)
    const before = container.querySelector('img')!.src
    act(() => {
      bumpPhotoVersion('Someone Else')
    })
    const after = container.querySelector('img')!.src
    expect(after).toBe(before)
  })
})
