import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Dialog } from './Dialog'

// jsdom doesn't implement HTMLDialogElement.showModal/close. Stub them so the
// useEffect inside Dialog doesn't throw and `dialog.open` reflects state.
beforeAll(() => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  HTMLDialogElement.prototype.showModal = vi.fn(function (this: any) {
    this.open = true
  })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  HTMLDialogElement.prototype.close = vi.fn(function (this: any) {
    this.open = false
  })
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('Dialog — open prop', () => {
  it('does not call showModal when open=false', () => {
    render(
      <Dialog open={false} onClose={() => {}}>
        <p>hidden body</p>
      </Dialog>,
    )

    expect(HTMLDialogElement.prototype.showModal).not.toHaveBeenCalled()
  })

  it('calls showModal when open=true', () => {
    render(
      <Dialog open={true} onClose={() => {}}>
        <p>visible body</p>
      </Dialog>,
    )

    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledTimes(1)
    // Body content always exists in DOM but is "hidden" by the dialog element
    // when not open. Here, since we shimmed open=true, content should be
    // queryable.
    expect(screen.getByText('visible body')).toBeInTheDocument()
  })

  it('calls close when transitioning from open=true to open=false', () => {
    const { rerender } = render(
      <Dialog open={true} onClose={() => {}}>
        <p>body</p>
      </Dialog>,
    )

    expect(HTMLDialogElement.prototype.showModal).toHaveBeenCalledTimes(1)

    rerender(
      <Dialog open={false} onClose={() => {}}>
        <p>body</p>
      </Dialog>,
    )

    expect(HTMLDialogElement.prototype.close).toHaveBeenCalledTimes(1)
  })
})

describe('Dialog — title', () => {
  it('renders the title when provided', () => {
    render(
      <Dialog open={true} onClose={() => {}} title="Hello">
        <p>body</p>
      </Dialog>,
    )

    expect(
      screen.getByRole('heading', { level: 2, name: 'Hello' }),
    ).toBeInTheDocument()
  })

  it('omits the title heading when not provided', () => {
    render(
      <Dialog open={true} onClose={() => {}}>
        <p>body</p>
      </Dialog>,
    )

    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })
})

describe('Dialog — onClose', () => {
  it('fires onClose when the × close button is clicked', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    render(
      <Dialog open={true} onClose={onClose}>
        <p>body</p>
      </Dialog>,
    )

    await user.click(screen.getByRole('button', { name: 'Close' }))
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('fires onClose when the backdrop (the dialog element itself) is clicked', () => {
    const onClose = vi.fn()

    const { container } = render(
      <Dialog open={true} onClose={onClose}>
        <p>body</p>
      </Dialog>,
    )

    // Click the dialog element directly (not its inner content). The handler
    // checks e.target === ref.current.
    const dialog = container.querySelector('dialog')!
    // userEvent would dispatch via the inner element due to overlap; trigger
    // a synthetic click whose target IS the dialog itself.
    dialog.dispatchEvent(new MouseEvent('click', { bubbles: true }))

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('does NOT fire onClose when clicking inside the content area', async () => {
    const user = userEvent.setup()
    const onClose = vi.fn()

    render(
      <Dialog open={true} onClose={onClose}>
        <p>body content</p>
      </Dialog>,
    )

    await user.click(screen.getByText('body content'))
    expect(onClose).not.toHaveBeenCalled()
  })
})

describe('Dialog — snapshot', () => {
  it('matches snapshot when open with title and body', () => {
    const { container } = render(
      <Dialog open={true} onClose={() => {}} title="Demo">
        <p>snapshot body</p>
      </Dialog>,
    )
    expect(container.firstChild).toMatchSnapshot()
  })
})
