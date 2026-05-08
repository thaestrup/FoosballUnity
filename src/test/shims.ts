// Shared browser-API shims used across snapshot and integration tests.
// jsdom does not implement <dialog>.showModal/close or HTMLMediaElement
// playback. Components that use the Dialog or play sounds (Tournament,
// Countdown) blow up without these.

import { vi } from 'vitest'

export const installDialogShim = (): void => {
  const proto = HTMLDialogElement.prototype as unknown as {
    showModal: () => void
    close: () => void
  }
  proto.showModal = function (this: HTMLDialogElement) {
    this.setAttribute('open', '')
    Object.defineProperty(this, 'open', { configurable: true, value: true })
  }
  proto.close = function (this: HTMLDialogElement) {
    this.removeAttribute('open')
    Object.defineProperty(this, 'open', { configurable: true, value: false })
  }
}

export const installMediaShim = (): void => {
  const proto = HTMLMediaElement.prototype as unknown as {
    play: () => Promise<void>
    pause: () => void
    load: () => void
  }
  proto.play = vi.fn(() => Promise.resolve())
  proto.pause = vi.fn()
  proto.load = vi.fn()
}

export const installScrollShim = (): void => {
  // PlayersList and other components call scrollIntoView after mount.
  Element.prototype.scrollIntoView = vi.fn()
  // TanStack Router's scroll restoration logs warnings without this.
  if (!(window as Window & { __scrollToShimmed?: boolean }).__scrollToShimmed) {
    window.scrollTo = vi.fn() as unknown as typeof window.scrollTo
    ;(window as Window & { __scrollToShimmed?: boolean }).__scrollToShimmed = true
  }
}

// Recharts uses ResizeObserver inside ResponsiveContainer. jsdom doesn't ship one.
export const installResizeObserverShim = (): void => {
  if (typeof globalThis.ResizeObserver === 'undefined') {
    class ResizeObserverPolyfill {
      observe(): void {}
      unobserve(): void {}
      disconnect(): void {}
    }
    ;(globalThis as unknown as { ResizeObserver: typeof ResizeObserverPolyfill }).ResizeObserver =
      ResizeObserverPolyfill
  }
}

export const installAllShims = (): void => {
  installDialogShim()
  installMediaShim()
  installScrollShim()
  installResizeObserverShim()
}
