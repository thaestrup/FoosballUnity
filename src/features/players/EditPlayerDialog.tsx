import { useCallback, useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ApiError } from '@/lib/api'
import { Avatar } from '@/components/Avatar'
import { playerPhotoUrl } from '@/lib/playerPhoto'
import { CropEditor } from './CropEditor'
import {
  useDeletePhoto,
  useDeletePlayer,
  useRenamePlayer,
  useUploadPhoto,
} from './usePlayers'
import type { Player } from './player'
import styles from './EditPlayerDialog.module.css'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp'] as const

// Map the DOMException names getUserMedia can throw into messages the
// user can act on. The default fallback includes the raw error message
// so the dev console isn't the only path to debug obscure failures.
const describeCameraError = (err: unknown): string => {
  if (!(err instanceof Error)) return "Couldn't open the camera."
  switch (err.name) {
    case 'NotAllowedError':
      return 'Camera access was denied.'
    case 'NotFoundError':
    case 'DevicesNotFoundError':
      return 'No camera detected on this device.'
    case 'NotReadableError':
    case 'TrackStartError':
      return 'Camera is already in use by another app.'
    case 'OverconstrainedError':
    case 'ConstraintNotSatisfiedError':
      return "Camera doesn't match the requested settings."
    case 'SecurityError':
      return 'Camera blocked — the page must be served over https or localhost.'
    default:
      return `Couldn't open the camera: ${err.message || err.name}`
  }
}

const Schema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(80, 'Name is too long'),
})
type FormValues = z.infer<typeof Schema>

type Props = {
  player: Player
  onClose: () => void
  onSaved?: (newName: string) => void
  // Fires after a successful DELETE /players/{name}. Callers (e.g. the
  // player detail page) can navigate away here; the list page just
  // closes the dialog and lets the cache invalidation refresh things.
  onDeleted?: (name: string) => void
}

export const EditPlayerDialog = ({
  player,
  onClose,
  onSaved,
  onDeleted,
}: Props) => {
  const renamePlayer = useRenamePlayer()
  const uploadPhoto = useUploadPhoto()
  const deletePhoto = useDeletePhoto()
  const deletePlayer = useDeletePlayer()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const [pickedFile, setPickedFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  // null = unknown yet, true/false = enumerateDevices() result. The button
  // hides itself when we know there's nothing to point at.
  const [cameraAvailable, setCameraAvailable] = useState<boolean | null>(null)
  // Active crop source. When non-null, the photo block switches to the
  // crop editor. The object URL is revoked when this clears.
  const [cropping, setCropping] = useState<
    { url: string; name: string } | null
  >(null)
  const [confirmingDelete, setConfirmingDelete] = useState(false)

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(Schema),
    defaultValues: { name: player.name },
  })

  // Render a local preview from the picked file while the user is
  // staging an upload. Cleanup the object URL on unmount or replacement.
  useEffect(() => {
    if (!pickedFile) {
      setPreviewUrl(null)
      return
    }
    const url = URL.createObjectURL(pickedFile)
    setPreviewUrl(url)
    return () => URL.revokeObjectURL(url)
  }, [pickedFile])

  // Revoke the crop source's object URL when the cropping session ends.
  useEffect(() => {
    if (!cropping) return
    return () => URL.revokeObjectURL(cropping.url)
  }, [cropping])

  // Always stop the camera tracks when the dialog unmounts — otherwise
  // the OS keeps the indicator light on.
  useEffect(() => {
    return () => {
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  // Probe enumerateDevices() once so we can hide "Use camera" on
  // hardware that has no video input (WSL, headless VMs, containers
  // without /dev/video0, desktops without a webcam). enumerateDevices
  // can be called without prompting for permission; labels are blank
  // pre-permission, but `kind === 'videoinput'` is reliable.
  useEffect(() => {
    let cancelled = false
    const md = navigator.mediaDevices
    if (!md || typeof md.enumerateDevices !== 'function') {
      setCameraAvailable(false)
      return
    }
    md.enumerateDevices()
      .then((devices) => {
        if (cancelled) return
        const hasVideoInput = devices.some((d) => d.kind === 'videoinput')
        setCameraAvailable(hasVideoInput)
      })
      .catch(() => {
        if (cancelled) return
        // Couldn't enumerate — fall back to showing the button so the
        // user can still try (the click handler will report any error).
        setCameraAvailable(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const onPickClick = () => fileInputRef.current?.click()

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormError(null)
    const file = e.target.files?.[0] ?? null
    if (!file) return
    if (!ACCEPTED_TYPES.includes(file.type as (typeof ACCEPTED_TYPES)[number])) {
      setFormError('Unsupported file type. Use JPEG, PNG, or WebP.')
      e.target.value = ''
      return
    }
    // Route the source through the crop editor first. Once the user
    // confirms a crop the resulting File replaces pickedFile.
    setCropping({ url: URL.createObjectURL(file), name: file.name })
    // Reset the input so re-picking the same file still triggers change.
    e.target.value = ''
  }

  const onCropApply = (file: File) => {
    setCropping(null)
    setPickedFile(file)
  }

  const onCropCancel = () => {
    setCropping(null)
  }

  // Pull the player's existing photo bytes from the backend and feed them
  // straight into the crop editor. Note: cropping a JPEG that's already
  // 512×512 produces a second-generation encode — fine for small reframes,
  // visibly worse if the user zooms in a lot.
  const onRecropClick = async () => {
    setFormError(null)
    try {
      const res = await fetch(playerPhotoUrl(player.name))
      if (res.status === 404) {
        setFormError('No photo to re-crop yet. Upload one first.')
        return
      }
      if (!res.ok) {
        setFormError(`Couldn't load the current photo (HTTP ${res.status}).`)
        return
      }
      const blob = await res.blob()
      setCropping({
        url: URL.createObjectURL(blob),
        name: `${player.name.replace(/\s+/g, '-')}-recrop.jpg`,
      })
    } catch (err) {
      setFormError(
        `Couldn't load the current photo: ${err instanceof Error ? err.message : String(err)}`,
      )
    }
  }

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    setCameraOpen(false)
  }

  const startCamera = async () => {
    setCameraError(null)
    setFormError(null)
    const md = navigator.mediaDevices
    if (!md || typeof md.getUserMedia !== 'function') {
      setCameraError(
        "This browser doesn't expose a camera API, or the page isn't served over https/localhost.",
      )
      return
    }
    try {
      // Keep constraints permissive — `{ video: true }` lets the browser
      // pick the best available camera. A `facingMode` hint can make
      // some desktop browsers reject the request when no front camera
      // exists.
      const stream = await md.getUserMedia({ video: true, audio: false })
      // Store the stream BEFORE flipping `cameraOpen`. The video ref
      // callback (see attachVideo below) consults streamRef the moment
      // the <video> element mounts and attaches immediately — no
      // race-y requestAnimationFrame timing needed.
      streamRef.current = stream
      setCameraOpen(true)
    } catch (err) {
      setCameraError(describeCameraError(err))
    }
  }

  // Callback ref: fires when React mounts (or unmounts) the <video>.
  // Attaching the stream here guarantees the video element exists in the
  // DOM before we set srcObject. Falls through cleanly if startCamera()
  // hasn't filled streamRef yet (e.g. in tests).
  const attachVideo = useCallback((v: HTMLVideoElement | null) => {
    videoRef.current = v
    if (!v) return
    const stream = streamRef.current
    if (!stream) return
    v.srcObject = stream
    void v.play().catch(() => {
      // Autoplay can be blocked on first user interaction in some
      // browsers; safe to ignore — the user can tap the video to play.
    })
  }, [])

  const capturePhoto = async () => {
    const video = videoRef.current
    if (!video) return
    const w = video.videoWidth || 640
    const h = video.videoHeight || 480
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = h
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.drawImage(video, 0, 0, w, h)
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', 0.85),
    )
    if (!blob) return
    // Hand the raw capture off to the crop editor instead of staging it
    // directly. Stop the camera so the OS releases the device.
    const name = `${player.name.replace(/\s+/g, '-')}-camera.jpg`
    setCropping({ url: URL.createObjectURL(blob), name })
    stopCamera()
  }

  const onRemovePhotoClick = () => {
    deletePhoto.mutate(player.name, {
      onError: (err) => {
        // A 404 here means the player simply had no photo. Treat as a
        // success — the user's intent ("remove the photo") is already
        // satisfied, no need to alarm them.
        if (err instanceof ApiError && err.status === 404) return
        setFormError(`Couldn't delete photo: ${err.message}`)
      },
    })
  }

  const onConfirmDelete = () => {
    setFormError(null)
    deletePlayer.mutate(player.name, {
      onSuccess: () => {
        onDeleted?.(player.name)
        onClose()
      },
      onError: (err) => {
        if (err instanceof ApiError && err.status === 404) {
          // Already gone — treat as success.
          onDeleted?.(player.name)
          onClose()
          return
        }
        setFormError(
          `Couldn't remove player: ${err instanceof Error ? err.message : String(err)}`,
        )
        setConfirmingDelete(false)
      },
    })
  }

  const onSubmit = async (values: FormValues) => {
    setFormError(null)
    let activeName = player.name
    const trimmed = values.name.trim()

    // 1. Rename (only if changed). Stop the flow on 409 so the user can
    //    pick a different name without losing the picked file.
    if (trimmed !== player.name) {
      try {
        await renamePlayer.mutateAsync({
          oldName: player.name,
          newName: trimmed,
        })
        activeName = trimmed
      } catch (err) {
        if (err instanceof ApiError && err.status === 409) {
          setFormError(`The name "${trimmed}" is already taken.`)
          return
        }
        if (err instanceof ApiError && err.status === 404) {
          setFormError('Player no longer exists.')
          return
        }
        setFormError(
          `Couldn't rename: ${err instanceof Error ? err.message : String(err)}`,
        )
        return
      }
    }

    // 2. Upload (only if a file was picked). The new name from step 1
    //    is the right key for the photo URL.
    if (pickedFile) {
      try {
        await uploadPhoto.mutateAsync({ name: activeName, file: pickedFile })
      } catch (err) {
        if (err instanceof ApiError) {
          if (err.status === 413) {
            setFormError('Photo is too big (max 2 MB after compression).')
            return
          }
          if (err.status === 415) {
            setFormError('Unsupported photo format.')
            return
          }
          if (err.status === 404) {
            setFormError('Player no longer exists.')
            return
          }
        }
        setFormError(
          `Couldn't upload photo: ${err instanceof Error ? err.message : String(err)}`,
        )
        return
      }
    }

    onSaved?.(activeName)
    onClose()
  }

  const busy =
    isSubmitting ||
    renamePlayer.isPending ||
    uploadPhoto.isPending ||
    deletePhoto.isPending ||
    deletePlayer.isPending

  return (
    <form className={styles.form} onSubmit={handleSubmit(onSubmit)}>
      {cropping ? (
        <CropEditor
          src={cropping.url}
          outputName={cropping.name}
          onCancel={onCropCancel}
          onApply={onCropApply}
        />
      ) : (
        <div className={styles.photoBlock}>
          <div className={styles.photoPreview}>
            {cameraOpen ? (
              <video
                ref={attachVideo}
                className={styles.previewImg}
                playsInline
                muted
                autoPlay
              />
            ) : previewUrl ? (
              <img
                src={previewUrl}
                alt="New photo preview"
                className={styles.previewImg}
              />
            ) : (
              <Avatar name={player.name} className={styles.previewImg} />
            )}
          </div>
          <div className={styles.photoActions}>
            {cameraOpen ? (
              <>
                <button
                  type="button"
                  className={styles.primary}
                  onClick={capturePhoto}
                  disabled={busy}
                >
                  Capture
                </button>
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={stopCamera}
                  disabled={busy}
                >
                  Cancel camera
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={onPickClick}
                  disabled={busy}
                >
                  {pickedFile ? 'Choose a different photo' : 'Choose photo'}
                </button>
                {cameraAvailable !== false && (
                  <button
                    type="button"
                    className={styles.secondary}
                    onClick={() => void startCamera()}
                    disabled={busy}
                  >
                    Use camera
                  </button>
                )}
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={() => void onRecropClick()}
                  disabled={busy}
                >
                  Re-crop current photo
                </button>
                <button
                  type="button"
                  className={styles.secondary}
                  onClick={onRemovePhotoClick}
                  disabled={busy}
                >
                  {deletePhoto.isPending ? 'Removing…' : 'Remove current photo'}
                </button>
              </>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className={styles.fileInput}
              onChange={onFileChange}
            />
            {cameraError && (
              <p className={styles.error} role="alert">
                {cameraError}
              </p>
            )}
            {pickedFile && !cameraOpen && (
              <p className={styles.helpText}>
                Will upload <strong>{pickedFile.name}</strong> on Save.
                Cropped to 512×512 JPEG.
              </p>
            )}
          </div>
        </div>
      )}

      <label className={styles.field}>
        <span className={styles.fieldLabel}>Name</span>
        <input
          type="text"
          className={styles.input}
          autoComplete="off"
          spellCheck={false}
          {...register('name')}
        />
        {errors.name && (
          <span className={styles.error}>{errors.name.message}</span>
        )}
      </label>

      {formError && (
        <p className={styles.error} role="alert">
          {formError}
        </p>
      )}

      <div className={styles.dangerZone}>
        {confirmingDelete ? (
          <div className={styles.confirmRow}>
            <span className={styles.confirmText}>
              Permanently remove <strong>{player.name}</strong>?
            </span>
            <button
              type="button"
              className={styles.secondary}
              onClick={() => setConfirmingDelete(false)}
              disabled={busy}
            >
              Cancel
            </button>
            <button
              type="button"
              className={styles.danger}
              onClick={onConfirmDelete}
              disabled={busy}
            >
              {deletePlayer.isPending ? 'Removing…' : 'Confirm delete'}
            </button>
          </div>
        ) : (
          <button
            type="button"
            className={styles.dangerLink}
            onClick={() => setConfirmingDelete(true)}
            disabled={busy}
          >
            Remove player…
          </button>
        )}
      </div>

      <div className={styles.actions}>
        <button
          type="button"
          className={styles.secondary}
          onClick={onClose}
          disabled={busy}
        >
          Cancel
        </button>
        <button type="submit" className={styles.primary} disabled={busy}>
          {busy ? 'Saving…' : 'Save'}
        </button>
      </div>
    </form>
  )
}
