import { afterEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Fab } from './Fab'

afterEach(() => {
  vi.restoreAllMocks()
})

describe('Fab', () => {
  it('renders a button with the label as both aria-label and title', () => {
    render(<Fab onClick={() => {}} label="Add player" />)

    const btn = screen.getByRole('button', { name: 'Add player' })
    expect(btn).toBeInTheDocument()
    expect(btn).toHaveAttribute('aria-label', 'Add player')
    expect(btn).toHaveAttribute('title', 'Add player')
    expect(btn).toHaveAttribute('type', 'button')
  })

  it('shows the default "+" icon when no icon prop is passed', () => {
    render(<Fab onClick={() => {}} label="Add" />)

    const btn = screen.getByRole('button', { name: 'Add' })
    expect(btn).toHaveTextContent('+')
  })

  it('renders a custom icon when one is provided', () => {
    render(
      <Fab
        onClick={() => {}}
        label="Report"
        icon={<span data-testid="custom-icon">★</span>}
      />,
    )

    expect(screen.getByTestId('custom-icon')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Report' })).not.toHaveTextContent(
      '+',
    )
  })

  it('fires onClick when clicked', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<Fab onClick={onClick} label="Go" />)

    await user.click(screen.getByRole('button', { name: 'Go' }))

    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('matches snapshot with default icon', () => {
    const { container } = render(<Fab onClick={() => {}} label="Add player" />)
    expect(container.firstChild).toMatchSnapshot()
  })

  it('matches snapshot with a custom icon', () => {
    const { container } = render(
      <Fab onClick={() => {}} label="Report" icon={<span>★</span>} />,
    )
    expect(container.firstChild).toMatchSnapshot()
  })
})
