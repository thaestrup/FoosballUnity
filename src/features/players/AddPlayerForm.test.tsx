import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { renderWithProviders } from '@/test/render'
import { resetFactoryIds, makePlayer } from '@/test/factories'
import { AddPlayerForm } from './AddPlayerForm'

const BASE = 'http://localhost:5050'

beforeEach(() => {
  resetFactoryIds()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('AddPlayerForm — render', () => {
  it('renders the input, submit button, and cancel button when onCancel is provided', async () => {
    renderWithProviders(<AddPlayerForm onCancel={() => {}} onAdded={() => {}} />)

    expect(await screen.findByPlaceholderText('Player name')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Add' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('does not render the cancel button when onCancel is not provided', () => {
    renderWithProviders(<AddPlayerForm onAdded={() => {}} />)

    expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument()
  })
})

describe('AddPlayerForm — validation', () => {
  it('shows an error when submitting an empty name', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AddPlayerForm onAdded={() => {}} />)

    // findBy waits for the router to mount the form.
    await user.click(await screen.findByRole('button', { name: 'Add' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Name is required')
  })

  it('shows an error when name exceeds 20 characters', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AddPlayerForm onAdded={() => {}} />)

    const input = await screen.findByPlaceholderText('Player name')
    await user.type(input, 'a'.repeat(21))
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Name must be 20 characters or fewer',
    )
  })

  it('shows an error for disallowed characters', async () => {
    const user = userEvent.setup()
    renderWithProviders(<AddPlayerForm onAdded={() => {}} />)

    const input = await screen.findByPlaceholderText('Player name')
    await user.type(input, 'Bad@Name!')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Letters, digits, spaces and hyphens only',
    )
  })

  it('flags duplicates against the existing players list (case-insensitive)', async () => {
    const user = userEvent.setup()
    // Override default GET /players/ so we get a deterministic existing list.
    server.use(
      http.get(`${BASE}/players/`, () =>
        HttpResponse.json([
          makePlayer({ name: 'Lars', playerReady: true }),
          makePlayer({ name: 'Joan', playerReady: false }),
        ]),
      ),
    )

    renderWithProviders(<AddPlayerForm onAdded={() => {}} />)

    // Wait until the players query resolves so the duplicate check can run.
    await waitFor(() => {
      // useQuery state is observable indirectly via the form working — give it a tick.
      expect(screen.getByPlaceholderText('Player name')).toBeEnabled()
    })

    const input = screen.getByPlaceholderText('Player name')
    await user.type(input, 'lars')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'lars is already on the list',
    )
  })

  it('accepts unicode letters, digits, spaces, and hyphens', async () => {
    const user = userEvent.setup()
    const requests: unknown[] = []
    server.use(
      http.get(`${BASE}/players/`, () => HttpResponse.json([])),
      http.post(`${BASE}/players/`, async ({ request }) => {
        requests.push(await request.json())
        return HttpResponse.text('insertPlayer: Søren-1, result: 1')
      }),
    )

    renderWithProviders(<AddPlayerForm onAdded={() => {}} />)

    const input = await screen.findByPlaceholderText('Player name')
    await user.type(input, 'Søren-1')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => expect(requests).toHaveLength(1))
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })
})

describe('AddPlayerForm — submission', () => {
  it('calls POST /players/ with the right body and invokes onAdded with the trimmed name', async () => {
    const user = userEvent.setup()
    const onAdded = vi.fn()
    const requests: Array<unknown> = []

    server.use(
      http.get(`${BASE}/players/`, () => HttpResponse.json([])),
      http.post(`${BASE}/players/`, async ({ request }) => {
        requests.push(await request.json())
        return HttpResponse.text('insertPlayer: Foo, result: 1')
      }),
    )

    renderWithProviders(<AddPlayerForm onAdded={onAdded} />)

    const input = await screen.findByPlaceholderText('Player name')
    await user.type(input, '  Foo  ')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => expect(onAdded).toHaveBeenCalledWith('Foo'))

    expect(requests).toHaveLength(1)
    const body = requests[0] as Array<{
      name: string
      playerReady: boolean
      registeredRFIDTag: string
      oprettet: string
    }>
    expect(body).toHaveLength(1)
    expect(body[0]).toMatchObject({
      name: 'Foo',
      playerReady: true,
      registeredRFIDTag: '',
    })
    expect(typeof body[0].oprettet).toBe('string')
  })

  it('surfaces a backend error message via setError on the name field', async () => {
    const user = userEvent.setup()
    server.use(
      http.get(`${BASE}/players/`, () => HttpResponse.json([])),
      http.post(`${BASE}/players/`, () =>
        HttpResponse.text('boom', { status: 500 }),
      ),
    )

    renderWithProviders(<AddPlayerForm onAdded={() => {}} />)

    const input = await screen.findByPlaceholderText('Player name')
    await user.type(input, 'Foo')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('500')
  })

  it('clears the input after a successful add', async () => {
    const user = userEvent.setup()
    server.use(
      http.get(`${BASE}/players/`, () => HttpResponse.json([])),
      http.post(`${BASE}/players/`, () =>
        HttpResponse.text('insertPlayer: Zed, result: 1'),
      ),
    )

    renderWithProviders(<AddPlayerForm onAdded={() => {}} />)

    const input = await screen.findByPlaceholderText('Player name')
    await user.type(input, 'Zed')
    await user.click(screen.getByRole('button', { name: 'Add' }))

    await waitFor(() => expect(input).toHaveValue(''))
  })
})

describe('AddPlayerForm — cancel', () => {
  it('invokes onCancel when the cancel button is clicked', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    renderWithProviders(<AddPlayerForm onCancel={onCancel} onAdded={() => {}} />)

    await user.click(await screen.findByRole('button', { name: 'Cancel' }))

    expect(onCancel).toHaveBeenCalledTimes(1)
  })
})

describe('AddPlayerForm — snapshot', () => {
  it('matches snapshot with default render', async () => {
    server.use(http.get(`${BASE}/players/`, () => HttpResponse.json([])))
    const { container } = renderWithProviders(
      <AddPlayerForm onAdded={() => {}} onCancel={() => {}} />,
    )
    // Wait for the form to settle (input enabled).
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Player name')).toBeEnabled()
    })
    expect(container.firstChild).toMatchSnapshot()
  })
})
