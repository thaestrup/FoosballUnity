import { useCallback, useEffect, useState } from 'react'
import Cropper from 'react-easy-crop'
import type { Area, Point } from 'react-easy-crop'
import styles from './CropEditor.module.css'

const OUTPUT_SIZE = 512 // final avatar dimension in CSS / source pixels
const OUTPUT_QUALITY = 0.85

type Props = {
  // Object URL or data URL of the source image.
  src: string
  // What to call the resulting File. Caller usually passes the source
  // filename so the server-side debug logs stay grep-able.
  outputName: string
  onCancel: () => void
  onApply: (file: File) => void
}

// Crops the source image to the user's selected area and produces a
// fixed-size square JPEG suitable for the photo upload endpoint. The
// avatar is rendered as a circle elsewhere; we still output a square so
// the server's content-type is straightforward and any future UI change
// (badge, different shape) doesn't need to re-upload.
const cropToFile = async (
  src: string,
  cropAreaPx: Area,
  name: string,
): Promise<File> => {
  const image = await loadImage(src)
  const canvas = document.createElement('canvas')
  canvas.width = OUTPUT_SIZE
  canvas.height = OUTPUT_SIZE
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas 2D context unavailable')
  ctx.drawImage(
    image,
    cropAreaPx.x,
    cropAreaPx.y,
    cropAreaPx.width,
    cropAreaPx.height,
    0,
    0,
    OUTPUT_SIZE,
    OUTPUT_SIZE,
  )
  const blob: Blob | null = await new Promise((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', OUTPUT_QUALITY),
  )
  if (!blob) throw new Error('Failed to encode JPEG')
  // Normalise to a .jpg extension so the type/extension match — the
  // server only looks at Content-Type but downstream tooling sometimes
  // sniffs the filename.
  return new File(
    [blob],
    name.replace(/\.[^.]+$/, '') + '.jpg',
    { type: 'image/jpeg' },
  )
}

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Image failed to load'))
    img.src = src
  })

export const CropEditor = ({ src, outputName, onCancel, onApply }: Props) => {
  const [crop, setCrop] = useState<Point>({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [areaPx, setAreaPx] = useState<Area | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset internal state if the source changes (user re-picks a file).
  useEffect(() => {
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setAreaPx(null)
    setError(null)
  }, [src])

  const onCropComplete = useCallback((_area: Area, areaPixels: Area) => {
    setAreaPx(areaPixels)
  }, [])

  const onApplyClick = async () => {
    if (!areaPx) return
    setBusy(true)
    setError(null)
    try {
      const file = await cropToFile(src, areaPx, outputName)
      onApply(file)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Crop failed')
      setBusy(false)
    }
  }

  return (
    <div className={styles.wrapper}>
      <div className={styles.cropArea} aria-label="Crop area">
        <Cropper
          image={src}
          crop={crop}
          zoom={zoom}
          aspect={1}
          // Circular cutout — matches the avatar shape so users can see
          // exactly how their face will be framed.
          cropShape="round"
          showGrid={false}
          onCropChange={setCrop}
          onZoomChange={setZoom}
          onCropComplete={onCropComplete}
        />
      </div>
      <label className={styles.zoomRow}>
        <span className={styles.zoomLabel}>Zoom</span>
        <input
          type="range"
          min={1}
          max={3}
          step={0.01}
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
          className={styles.zoomInput}
          aria-label="Zoom"
        />
      </label>
      {error && (
        <p className={styles.error} role="alert">
          {error}
        </p>
      )}
      <div className={styles.actions}>
        <button
          type="button"
          className={styles.secondary}
          onClick={onCancel}
          disabled={busy}
        >
          Cancel
        </button>
        <button
          type="button"
          className={styles.primary}
          onClick={() => void onApplyClick()}
          disabled={busy || !areaPx}
        >
          {busy ? 'Cropping…' : 'Use this crop'}
        </button>
      </div>
    </div>
  )
}
