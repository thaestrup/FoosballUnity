import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { server } from '@/test/server'
import { renderWithProviders } from '@/test/render'
import { installAllShims } from '@/test/shims'
import { makePlayer, resetFactoryIds } from '@/test/factories'
import { GamesList } from '@/features/games/GamesList'

const BASE = 'http://localhost:5050'

beforeEach(() => {
  resetFactoryIds()
  installAllShims()
})

afterEach(() => {
  vi.restoreAllMocks()
})

describe('integration: search-param prefill auto-opens report dialog', () => {
  it('opens the report dialog with the four players preselected when prefill is provided', async () => {
    const captured: unknown[] = []
    server.use(
      http.get(`${BASE}/players/`, () =>
        HttpResponse.json([
          makePlayer({ name: 'Lars', playerReady: true }),
          makePlayer({ name: 'Joan', playerReady: true }),
          makePlayer({ name: 'Frank', playerReady: true }),
          makePlayer({ name: 'Daniel', playerReady: true }),
        ]),
      ),
      http.post(`${BASE}/games/`, async ({ request }) => {
        captured.push(await request.json())
        return HttpResponse.json({ newGameIDs: ['9'] })
      }),
    )

    // The route file extracts these search params from the URL and passes
    // them down as `prefill`. We exercise the route component (`GamesPage`)
    // by passing the same prefill prop directly to GamesList.
    const user = userEvent.setup()
    const { container } = renderWithProviders(
      <GamesList
        prefill={{ red1: 'Lars', red2: 'Joan', blue1: 'Frank', blue2: 'Daniel' }}
      />,
      { initialUrl: '/games?red1=Lars&red2=Joan&blue1=Frank&blue2=Daniel' },
    )

    // Dialog auto-opens because prefill !== null. Wait for the element to
    // mount and for the showModal effect to fire.
    const dialog = await waitFor(() => {
      const d = container.querySelector('dialog')
      if (!d || !d.hasAttribute('open')) {
        throw new Error('dialog not yet open')
      }
      return d
    })

    // Cancel button is the simplest probe that the dialog mounted its body.
    expect(
      await screen.findByRole('button', { name: /^Cancel$/ }),
    ).toBeInTheDocument()

    // The form has four <select> elements (combobox role) with options
    // populated from the players query.
    const selects = screen.getAllByRole('combobox') as HTMLSelectElement[]
    expect(selects).toHaveLength(4)
    expect(selects[0]).toHaveAttribute('name', 'red1')
    expect(selects[1]).toHaveAttribute('name', 'red2')
    expect(selects[2]).toHaveAttribute('name', 'blue1')
    expect(selects[3]).toHaveAttribute('name', 'blue2')

    // RHF doesn't apply `selected` to <option> elements — it tracks state via
    // refs — so HTMLSelectElement.value remains '' until user interaction.
    // Verify the prefill propagated by submitting the form and inspecting
    // the captured POST body.
    await within(dialog).findAllByRole('option', { name: 'Lars' })
    const submit = within(dialog).getByRole('button', { name: /^Report game$/ })
    await user.click(submit)

    await waitFor(() => expect(captured).toHaveLength(1))
    const body = captured[0] as Array<Record<string, unknown>>
    expect(body[0]).toMatchObject({
      player_red_1: 'Lars',
      player_red_2: 'Joan',
      player_blue_1: 'Frank',
      player_blue_2: 'Daniel',
    })
  })
})
