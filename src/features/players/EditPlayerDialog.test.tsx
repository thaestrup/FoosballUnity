import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { http, HttpResponse } from 'msw'
import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { server } from '@/test/server'
import { renderWithProviders } from '@/test/render'
import { makePlayer } from '@/test/factories'
import { EditPlayerDialog } from './EditPlayerDialog'
import { __resetPhotoVersionsForTests } from '@/lib/playerPhoto'

const BASE = 'http://localhost:5050'

beforeEach(() => {
  __resetPhotoVersionsForTests()
  // jsdom doesn't ship URL.createObjectURL / revokeObjectURL. Tests that
  // exercise the file-pick → crop flow rely on them; stub with no-ops so
  // the file change handler doesn't throw.
  if (typeof URL.createObjectURL !== 'function') {
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      writable: true,
      value: () => 'blob:stub',
    })
  }
  if (typeof URL.revokeObjectURL !== 'function') {
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      writable: true,
      value: () => {},
    })
  }
})

afterEach(() => {
  __resetPhotoVersionsForTests()
  vi.restoreAllMocks()
})

const samplePlayer = makePlayer({ name: 'Lars' })

describe('EditPlayerDialog — rename', () => {
  it('calls PUT /players/{name}/rename with the new name on Save', async () => {
    let captured: { newName?: string } | null = null
    server.use(
      http.put(`${BASE}/players/Lars/rename`, async ({ request }) => {
        captured = (await request.json()) as { newName: string }
        return HttpResponse.text('rename: Lars -> Lars2, games updated: 0')
      }),
    )
    const onSaved = vi.fn()
    const onClose = vi.fn()

    const user = userEvent.setup()
    renderWithProviders(
      <EditPlayerDialog player={samplePlayer} onClose={onClose} onSaved={onSaved} />,
    )

    const nameInput = (await screen.findByLabelText(/^name$/i)) as HTMLInputElement
    await user.clear(nameInput)
    await user.type(nameInput, 'Lars2')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(captured).not.toBeNull())
    expect(captured!.newName).toBe('Lars2')
    expect(onSaved).toHaveBeenCalledWith('Lars2')
    expect(onClose).toHaveBeenCalled()
  })

  it('surfaces an inline error when the rename returns 409', async () => {
    server.use(
      http.put(`${BASE}/players/Lars/rename`, () =>
        HttpResponse.text('name taken', { status: 409 }),
      ),
    )
    const onSaved = vi.fn()
    const onClose = vi.fn()

    const user = userEvent.setup()
    renderWithProviders(
      <EditPlayerDialog player={samplePlayer} onClose={onClose} onSaved={onSaved} />,
    )

    const nameInput = await screen.findByLabelText(/^name$/i)
    await user.clear(nameInput)
    await user.type(nameInput, 'Joan')
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    expect(
      await screen.findByText(/the name "Joan" is already taken/i),
    ).toBeInTheDocument()
    expect(onSaved).not.toHaveBeenCalled()
    expect(onClose).not.toHaveBeenCalled()
  })

  it('skips the rename PUT when the name was not edited', async () => {
    let renameCalls = 0
    server.use(
      http.put(`${BASE}/players/:name/rename`, () => {
        renameCalls += 1
        return HttpResponse.text('rename done')
      }),
    )
    const onClose = vi.fn()

    const user = userEvent.setup()
    renderWithProviders(
      <EditPlayerDialog player={samplePlayer} onClose={onClose} />,
    )

    await screen.findByLabelText(/^name$/i)
    await user.click(screen.getByRole('button', { name: /^save$/i }))

    await waitFor(() => expect(onClose).toHaveBeenCalled())
    expect(renameCalls).toBe(0)
  })
})

describe('EditPlayerDialog — photo delete', () => {
  it('calls DELETE /players/{name}/photo when the user clicks Remove', async () => {
    let deleted = false
    server.use(
      http.delete(`${BASE}/players/Lars/photo`, () => {
        deleted = true
        return HttpResponse.text('deletePhoto: Lars')
      }),
    )

    const user = userEvent.setup()
    renderWithProviders(
      <EditPlayerDialog player={samplePlayer} onClose={() => {}} />,
    )

    await user.click(
      await screen.findByRole('button', { name: /remove current photo/i }),
    )

    await waitFor(() => expect(deleted).toBe(true))
  })

  it('silently treats a 404 on Remove as success (no photo to delete)', async () => {
    server.use(
      http.delete(`${BASE}/players/Lars/photo`, () =>
        HttpResponse.text('not found', { status: 404 }),
      ),
    )

    const user = userEvent.setup()
    renderWithProviders(
      <EditPlayerDialog player={samplePlayer} onClose={() => {}} />,
    )

    await user.click(
      await screen.findByRole('button', { name: /remove current photo/i }),
    )

    // No "couldn't delete" error banner should appear.
    await waitFor(() => {
      expect(
        screen.queryByText(/couldn't delete photo/i),
      ).not.toBeInTheDocument()
    })
  })
})

describe('EditPlayerDialog — remove player (delete)', () => {
  it('shows an inline confirmation before issuing DELETE', async () => {
    let deletes = 0
    server.use(
      http.delete(`${BASE}/players/Lars`, () => {
        deletes += 1
        return HttpResponse.text('deletePlayer: Lars')
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(
      <EditPlayerDialog player={samplePlayer} onClose={() => {}} />,
    )

    await user.click(
      await screen.findByRole('button', { name: /remove player/i }),
    )

    // Confirmation block appears; no DELETE has fired yet.
    expect(
      screen.getByText(/permanently remove/i),
    ).toBeInTheDocument()
    expect(deletes).toBe(0)
  })

  it('calls DELETE /players/{name} and fires onDeleted + onClose on confirm', async () => {
    let deletePath = ''
    server.use(
      http.delete(`${BASE}/players/:name`, ({ params }) => {
        deletePath = String(params.name)
        return HttpResponse.text(`deletePlayer: ${params.name}`)
      }),
    )
    const onClose = vi.fn()
    const onDeleted = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(
      <EditPlayerDialog
        player={samplePlayer}
        onClose={onClose}
        onDeleted={onDeleted}
      />,
    )

    await user.click(
      await screen.findByRole('button', { name: /remove player/i }),
    )
    await user.click(screen.getByRole('button', { name: /confirm delete/i }))

    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledWith('Lars')
      expect(onClose).toHaveBeenCalled()
    })
    expect(deletePath).toBe('Lars')
  })

  it('Cancel on the confirmation dismisses without deleting', async () => {
    let deletes = 0
    server.use(
      http.delete(`${BASE}/players/Lars`, () => {
        deletes += 1
        return HttpResponse.text('deletePlayer: Lars')
      }),
    )
    const user = userEvent.setup()
    renderWithProviders(
      <EditPlayerDialog player={samplePlayer} onClose={() => {}} />,
    )

    await user.click(
      await screen.findByRole('button', { name: /remove player/i }),
    )
    // The confirmation row has its own Cancel button. Scope by parent so
    // we don't grab the outer dialog's Cancel.
    const confirmRow = screen
      .getByText(/permanently remove/i)
      .closest('div')!
    await user.click(
      within(confirmRow).getByRole('button', { name: /^cancel$/i }),
    )

    // Back to the link-style "Remove player…" trigger, no DELETE fired.
    expect(deletes).toBe(0)
    expect(
      await screen.findByRole('button', { name: /remove player/i }),
    ).toBeInTheDocument()
  })

  it('treats a 404 on delete as success (already gone)', async () => {
    server.use(
      http.delete(`${BASE}/players/Lars`, () =>
        HttpResponse.text('not found', { status: 404 }),
      ),
    )
    const onClose = vi.fn()
    const onDeleted = vi.fn()
    const user = userEvent.setup()
    renderWithProviders(
      <EditPlayerDialog
        player={samplePlayer}
        onClose={onClose}
        onDeleted={onDeleted}
      />,
    )

    await user.click(
      await screen.findByRole('button', { name: /remove player/i }),
    )
    await user.click(screen.getByRole('button', { name: /confirm delete/i }))

    await waitFor(() => {
      expect(onDeleted).toHaveBeenCalledWith('Lars')
      expect(onClose).toHaveBeenCalled()
    })
  })
})

describe('EditPlayerDialog — re-crop existing photo', () => {
  it('routes the existing photo into the crop editor on "Re-crop current photo"', async () => {
    // Backend responds with a JPEG body for the photo GET.
    server.use(
      http.get(`${BASE}/players/Lars/photo`, () =>
        HttpResponse.arrayBuffer(new Uint8Array([0xff, 0xd8, 0xff]).buffer, {
          headers: { 'Content-Type': 'image/jpeg' },
        }),
      ),
    )

    const user = userEvent.setup()
    renderWithProviders(
      <EditPlayerDialog player={samplePlayer} onClose={() => {}} />,
    )

    await user.click(
      await screen.findByRole('button', { name: /re-crop current photo/i }),
    )

    expect(
      await screen.findByRole('button', { name: /use this crop/i }),
    ).toBeInTheDocument()
  })

  it('shows an inline message when the player has no photo to re-crop', async () => {
    server.use(
      http.get(`${BASE}/players/Lars/photo`, () =>
        new HttpResponse(null, { status: 404 }),
      ),
    )

    const user = userEvent.setup()
    renderWithProviders(
      <EditPlayerDialog player={samplePlayer} onClose={() => {}} />,
    )

    await user.click(
      await screen.findByRole('button', { name: /re-crop current photo/i }),
    )

    expect(
      await screen.findByText(/no photo to re-crop yet/i),
    ).toBeInTheDocument()
    // Crop editor should NOT have opened.
    expect(
      screen.queryByRole('button', { name: /use this crop/i }),
    ).not.toBeInTheDocument()
  })
})

describe('EditPlayerDialog — crop flow', () => {
  it('routes a picked file into the crop editor instead of staging it directly', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <EditPlayerDialog player={samplePlayer} onClose={() => {}} />,
    )

    await screen.findByLabelText(/^name$/i)
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement
    const file = new File(['hello'], 'shot.jpg', { type: 'image/jpeg' })
    await user.upload(fileInput, file)

    // The crop editor takes over: "Use this crop" + a fresh Cancel
    // appear, and the "Choose photo" trigger disappears while cropping.
    expect(
      await screen.findByRole('button', { name: /use this crop/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /choose photo/i }),
    ).not.toBeInTheDocument()
  })

  it('returns to the normal photo block when crop is cancelled', async () => {
    const user = userEvent.setup()
    renderWithProviders(
      <EditPlayerDialog player={samplePlayer} onClose={() => {}} />,
    )

    await screen.findByLabelText(/^name$/i)
    const fileInput = document.querySelector(
      'input[type="file"]',
    ) as HTMLInputElement
    await user.upload(
      fileInput,
      new File(['x'], 'a.jpg', { type: 'image/jpeg' }),
    )

    // Find the crop editor's Cancel button by walking up from "Use this
    // crop" — there's also a dialog-level Cancel, so we have to scope.
    const apply = await screen.findByRole('button', {
      name: /use this crop/i,
    })
    const cropPanel = apply.closest('div')!.parentElement!
    await user.click(within(cropPanel).getByRole('button', { name: /^cancel$/i }))

    // Back to the regular photo block buttons.
    expect(
      await screen.findByRole('button', { name: /choose photo/i }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('button', { name: /use this crop/i }),
    ).not.toBeInTheDocument()
  })
})

describe('EditPlayerDialog — camera capture', () => {
  // Helper: stub navigator.mediaDevices with an enumerateDevices() that
  // reports a video input present (otherwise the dialog hides the
  // button) and a getUserMedia override for the specific test.
  const stubMediaDevices = (
    overrides: Partial<MediaDevices> & Pick<MediaDevices, 'getUserMedia'>,
  ) => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        enumerateDevices: vi
          .fn()
          .mockResolvedValue([
            { kind: 'videoinput', deviceId: 'cam1', label: 'mock', groupId: 'g1' },
          ]),
        ...overrides,
      },
    })
  }

  it('calls getUserMedia when "Use camera" is clicked', async () => {
    const getUserMedia = vi.fn().mockResolvedValue({
      getTracks: () => [{ stop: vi.fn() }],
    } as unknown as MediaStream)
    stubMediaDevices({ getUserMedia })

    const user = userEvent.setup()
    renderWithProviders(
      <EditPlayerDialog player={samplePlayer} onClose={() => {}} />,
    )

    await user.click(
      await screen.findByRole('button', { name: /use camera/i }),
    )

    await waitFor(() => expect(getUserMedia).toHaveBeenCalled())
    const call = getUserMedia.mock.calls[0]?.[0] as MediaStreamConstraints
    expect(call.video).toBeDefined()
  })

  it('surfaces a friendly error when camera access is denied', async () => {
    const denied = new Error('denied')
    denied.name = 'NotAllowedError'
    stubMediaDevices({ getUserMedia: vi.fn().mockRejectedValue(denied) })

    const user = userEvent.setup()
    renderWithProviders(
      <EditPlayerDialog player={samplePlayer} onClose={() => {}} />,
    )

    await user.click(
      await screen.findByRole('button', { name: /use camera/i }),
    )

    expect(
      await screen.findByText(/camera access was denied/i),
    ).toBeInTheDocument()
  })

  it('hides the "Use camera" button when no video input is enumerated', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      configurable: true,
      value: {
        // Audio input but no video — common in WSL / VMs / containers.
        enumerateDevices: vi.fn().mockResolvedValue([
          { kind: 'audioinput', deviceId: 'a', label: '', groupId: '' },
        ]),
        getUserMedia: vi.fn(),
      },
    })

    renderWithProviders(
      <EditPlayerDialog player={samplePlayer} onClose={() => {}} />,
    )

    // Wait for the enumerate Promise to resolve, then assert absence.
    await screen.findByRole('button', { name: /choose photo/i })
    await waitFor(() => {
      expect(
        screen.queryByRole('button', { name: /use camera/i }),
      ).not.toBeInTheDocument()
    })
  })

  it('maps NotFoundError to a "No camera detected" message', async () => {
    const notFound = new Error('not found')
    notFound.name = 'NotFoundError'
    stubMediaDevices({ getUserMedia: vi.fn().mockRejectedValue(notFound) })

    const user = userEvent.setup()
    renderWithProviders(
      <EditPlayerDialog player={samplePlayer} onClose={() => {}} />,
    )

    await user.click(
      await screen.findByRole('button', { name: /use camera/i }),
    )

    expect(
      await screen.findByText(/no camera detected/i),
    ).toBeInTheDocument()
  })
})
