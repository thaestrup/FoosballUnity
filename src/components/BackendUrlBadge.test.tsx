import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { renderWithProviders } from '@/test/render'
import { BackendUrlBadge } from './BackendUrlBadge'
import {
  clearBackendUrlOverride,
  getBackendUrlDefault,
  setBackendUrlOverride,
} from '@/lib/backendUrl'

beforeEach(() => {
  window.sessionStorage.clear()
  clearBackendUrlOverride()
})

afterEach(() => {
  window.sessionStorage.clear()
  clearBackendUrlOverride()
})

describe('BackendUrlBadge — chip rendering', () => {
  it('shows the default URL (host portion) when no override is set', async () => {
    renderWithProviders(<BackendUrlBadge />)
    // The Dialog renders its body into the DOM even when closed (jsdom
    // doesn't enforce hiding), so scope the assertion to the chip button.
    const chip = await screen.findByRole('button', { name: /API/ })
    expect(within(chip).getByText(/localhost:5050/)).toBeInTheDocument()
    // No "override active" dot when default is in effect.
    expect(
      within(chip).queryByRole('status', { name: /override active/i }),
    ).not.toBeInTheDocument()
  })

  it('shows an "override active" indicator when an override is set', async () => {
    setBackendUrlOverride('http://override.test:9999')
    renderWithProviders(<BackendUrlBadge />)
    const chip = await screen.findByRole('button', { name: /API/ })
    expect(within(chip).getByText(/override.test:9999/)).toBeInTheDocument()
    expect(
      within(chip).getByRole('status', { name: /override active/i }),
    ).toBeInTheDocument()
  })
})

describe('BackendUrlBadge — editing', () => {
  it('opens the editor pre-filled with the current URL', async () => {
    const user = userEvent.setup()
    renderWithProviders(<BackendUrlBadge />)

    await user.click(await screen.findByRole('button', { name: /API/ }))

    const input = (await screen.findByLabelText(/API URL/i)) as HTMLInputElement
    expect(input.value).toBe(getBackendUrlDefault())
  })

  it('saves a valid override and persists it', async () => {
    const user = userEvent.setup()
    renderWithProviders(<BackendUrlBadge />)

    await user.click(await screen.findByRole('button', { name: /API/ }))
    const input = await screen.findByLabelText(/API URL/i)
    await user.clear(input)
    await user.type(input, 'http://new-host.test:7000')
    await user.click(screen.getByRole('button', { name: /^Save$/ }))

    await waitFor(() => {
      expect(window.sessionStorage.getItem('backendUrl:override')).toBe(
        'http://new-host.test:7000',
      )
    })
  })

  it('rejects an invalid URL with an inline error and does not save', async () => {
    const user = userEvent.setup()
    renderWithProviders(<BackendUrlBadge />)

    await user.click(await screen.findByRole('button', { name: /API/ }))
    const input = await screen.findByLabelText(/API URL/i)
    await user.clear(input)
    await user.type(input, 'not a url')
    await user.click(screen.getByRole('button', { name: /^Save$/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      /not a valid url/i,
    )
    expect(window.sessionStorage.getItem('backendUrl:override')).toBeNull()
  })

  it('rejects non-http(s) protocols', async () => {
    const user = userEvent.setup()
    renderWithProviders(<BackendUrlBadge />)

    await user.click(await screen.findByRole('button', { name: /API/ }))
    const input = await screen.findByLabelText(/API URL/i)
    await user.clear(input)
    await user.type(input, 'ftp://example.test')
    await user.click(screen.getByRole('button', { name: /^Save$/ }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/http/i)
    expect(window.sessionStorage.getItem('backendUrl:override')).toBeNull()
  })

  it('clears the override when the saved value equals the default', async () => {
    setBackendUrlOverride('http://something-else.test')
    const user = userEvent.setup()
    renderWithProviders(<BackendUrlBadge />)

    await user.click(await screen.findByRole('button', { name: /API/ }))
    const input = await screen.findByLabelText(/API URL/i)
    await user.clear(input)
    await user.type(input, getBackendUrlDefault())
    await user.click(screen.getByRole('button', { name: /^Save$/ }))

    await waitFor(() => {
      expect(window.sessionStorage.getItem('backendUrl:override')).toBeNull()
    })
  })

  it('renders "Reset to default" only when overridden and clears via that button', async () => {
    setBackendUrlOverride('http://override.test:9999')
    const user = userEvent.setup()
    renderWithProviders(<BackendUrlBadge />)

    await user.click(await screen.findByRole('button', { name: /API/ }))
    const resetBtn = await screen.findByRole('button', {
      name: /reset to default/i,
    })
    await user.click(resetBtn)

    await waitFor(() => {
      expect(window.sessionStorage.getItem('backendUrl:override')).toBeNull()
    })
  })

  it('hides "Reset to default" when no override is active', async () => {
    const user = userEvent.setup()
    renderWithProviders(<BackendUrlBadge />)

    await user.click(await screen.findByRole('button', { name: /API/ }))
    await screen.findByLabelText(/API URL/i)
    expect(
      screen.queryByRole('button', { name: /reset to default/i }),
    ).not.toBeInTheDocument()
  })

  it('trims a trailing slash from the saved URL', async () => {
    const user = userEvent.setup()
    renderWithProviders(<BackendUrlBadge />)

    await user.click(await screen.findByRole('button', { name: /API/ }))
    const input = await screen.findByLabelText(/API URL/i)
    await user.clear(input)
    await user.type(input, 'http://trailing.test:8000/')
    await user.click(screen.getByRole('button', { name: /^Save$/ }))

    await waitFor(() => {
      expect(window.sessionStorage.getItem('backendUrl:override')).toBe(
        'http://trailing.test:8000',
      )
    })
  })
})
