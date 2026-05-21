import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { ErrorNotice } from './ErrorNotice'
import { NetworkError, ApiError } from '@/lib/api'

describe('ErrorNotice', () => {
  it('renders "Couldn\'t load {what}" when `what` is provided', () => {
    render(<ErrorNotice what="games" error={new Error('x')} />)
    expect(screen.getByText("Couldn't load games")).toBeInTheDocument()
  })

  it('uses the explicit `title` over `what` when both are passed', () => {
    render(
      <ErrorNotice title="Custom heading" what="games" error={new Error('x')} />,
    )
    expect(screen.getByText('Custom heading')).toBeInTheDocument()
    expect(screen.queryByText("Couldn't load games")).not.toBeInTheDocument()
  })

  it('shows the friendly backend-unreachable copy for a NetworkError', async () => {
    // NetworkError path renders BackendUrlBadge, which calls useQueryClient,
    // so we need the QueryClientProvider that renderWithProviders supplies.
    renderWithProviders(<ErrorNotice what="games" error={new NetworkError()} />)
    expect(
      await screen.findByText(/backend isn't responding/i),
    ).toBeInTheDocument()
    expect(
      screen.queryByText(/^Backend is not responding$/),
    ).not.toBeInTheDocument()
  })

  it('shows the raw error message for non-NetworkError errors', () => {
    render(
      <ErrorNotice what="games" error={new ApiError('GET /games → 500', 500)} />,
    )
    expect(screen.getByText('GET /games → 500')).toBeInTheDocument()
  })

  it('renders a Retry button when onRetry is provided and invokes it on click', async () => {
    const user = userEvent.setup()
    const onRetry = vi.fn()
    renderWithProviders(
      <ErrorNotice
        what="games"
        error={new NetworkError()}
        onRetry={onRetry}
      />,
    )
    const btn = await screen.findByRole('button', { name: /^retry$/i })
    await user.click(btn)
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it('omits the Retry button when onRetry is not provided', async () => {
    renderWithProviders(<ErrorNotice what="games" error={new NetworkError()} />)
    await screen.findByText(/backend isn't responding/i)
    expect(
      screen.queryByRole('button', { name: /^retry$/i }),
    ).not.toBeInTheDocument()
  })

  it('has role="alert" so screen readers announce the failure', async () => {
    renderWithProviders(<ErrorNotice what="games" error={new NetworkError()} />)
    expect(await screen.findByRole('alert')).toBeInTheDocument()
  })
})
