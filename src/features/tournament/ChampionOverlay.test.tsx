import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'
import { ChampionOverlay } from './ChampionOverlay'
import { makeRankingItem } from '@/test/factories'

const top3 = [
  makeRankingItem({ name: 'Lars', points: 1600, position: 1 }),
  makeRankingItem({ name: 'Joan', points: 1550, position: 2 }),
  makeRankingItem({ name: 'Frank', points: 1500, position: 3 }),
]

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('ChampionOverlay', () => {
  it('renders top 3 podium with gold/silver/bronze places', () => {
    render(<ChampionOverlay top={top3} onDismiss={() => {}} />)

    // All three names appear
    expect(screen.getByText('Lars')).toBeInTheDocument()
    expect(screen.getByText('Joan')).toBeInTheDocument()
    expect(screen.getByText('Frank')).toBeInTheDocument()

    // Podium platform numbers visible (1 = gold, 2 = silver, 3 = bronze)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()

    // Points are shown
    expect(screen.getByText('1600')).toBeInTheDocument()
    expect(screen.getByText('1550')).toBeInTheDocument()
    expect(screen.getByText('1500')).toBeInTheDocument()
  })

  it('renders the podium in silver-gold-bronze DOM order (so gold sits centred)', () => {
    const { container } = render(
      <ChampionOverlay top={top3} onDismiss={() => {}} />,
    )

    // Each step renders the player name plus the place number; the place
    // numbers appear in DOM order: 2, 1, 3.
    const places = Array.from(container.querySelectorAll('div'))
      .map((el) => el.textContent ?? '')
      .filter((t) => t === '2' || t === '1' || t === '3')

    // The first three matches correspond to the platform divs.
    expect(places.slice(0, 3)).toEqual(['2', '1', '3'])
  })

  it('returns null and renders nothing when top is empty', () => {
    const { container } = render(
      <ChampionOverlay top={[]} onDismiss={() => {}} />,
    )
    expect(container.firstChild).toBeNull()
  })

  it('auto-dismisses after 5 seconds', () => {
    const onDismiss = vi.fn()
    render(<ChampionOverlay top={top3} onDismiss={onDismiss} />)

    // Just before 5s, no dismissal yet
    vi.advanceTimersByTime(4999)
    expect(onDismiss).not.toHaveBeenCalled()

    // Cross the 5s threshold
    vi.advanceTimersByTime(1)
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('clears the auto-dismiss timer on unmount', () => {
    const onDismiss = vi.fn()
    const { unmount } = render(
      <ChampionOverlay top={top3} onDismiss={onDismiss} />,
    )
    unmount()
    vi.advanceTimersByTime(10000)
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('dismisses when the backdrop (dialog root) is clicked', () => {
    const onDismiss = vi.fn()
    render(<ChampionOverlay top={top3} onDismiss={onDismiss} />)

    fireEvent.click(screen.getByRole('dialog', { name: /new leader/i }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('renders fewer steps when fewer rankings provided', () => {
    render(
      <ChampionOverlay top={[top3[0]]} onDismiss={() => {}} />,
    )
    expect(screen.getByText('Lars')).toBeInTheDocument()
    expect(screen.queryByText('Joan')).not.toBeInTheDocument()
    expect(screen.queryByText('Frank')).not.toBeInTheDocument()
  })

  it('dismisses when Escape is pressed (a11y: keyboard users need an exit)', () => {
    const onDismiss = vi.fn()
    render(<ChampionOverlay top={top3} onDismiss={onDismiss} />)

    fireEvent.keyDown(window, { key: 'Escape' })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('moves focus to the dialog on mount so screen readers announce it', () => {
    render(<ChampionOverlay top={top3} onDismiss={() => {}} />)
    const dialog = screen.getByRole('dialog', { name: /new leader/i })
    expect(dialog).toHaveFocus()
  })

  it('matches snapshot with full top 3', () => {
    const { container } = render(
      <ChampionOverlay top={top3} onDismiss={() => {}} />,
    )
    expect(container.firstChild).toMatchSnapshot()
  })
})
