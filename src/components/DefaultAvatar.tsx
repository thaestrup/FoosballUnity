// Neutral silhouette shown when a player has no photo (or when the photo
// request 404s — the backend can't distinguish "no photo" from "unknown
// player", so any failure resolves to this). Inline SVG so the frontend
// doesn't need to ship a bundled fallback image after the per-player
// jpgs went away.

type Props = {
  className?: string
}

export const DefaultAvatar = ({ className }: Props) => {
  return (
    <svg
      className={className}
      viewBox="0 0 64 64"
      role="img"
      aria-label="No photo"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="64" height="64" rx="32" fill="currentColor" opacity="0.08" />
      <circle cx="32" cy="25" r="11" fill="currentColor" opacity="0.45" />
      <path
        d="M12 56c0-10.493 8.954-19 20-19s20 8.507 20 19"
        fill="currentColor"
        opacity="0.45"
      />
    </svg>
  )
}
