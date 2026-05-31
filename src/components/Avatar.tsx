import { useEffect, useState } from 'react'
import { playerPhotoUrl, usePhotoVersion } from '@/lib/playerPhoto'
import { DefaultAvatar } from './DefaultAvatar'

type Props = {
  name: string
  className?: string
}

// Renders the player's photo from the backend, falling back to the
// neutral silhouette when the request 404s (the backend returns 404 both
// for "no photo set" and "no such player" — we can't distinguish, and
// the silhouette is the right answer either way).
export const Avatar = ({ name, className }: Props) => {
  const [errored, setErrored] = useState(false)
  const version = usePhotoVersion(name)

  // Reset the error flag whenever the name changes — the next player
  // might have a photo even if the previous one didn't.
  useEffect(() => {
    setErrored(false)
  }, [name])

  if (errored) {
    return <DefaultAvatar className={className} />
  }
  return (
    <img
      src={`${playerPhotoUrl(name)}?v=${version}`}
      alt=""
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => setErrored(true)}
    />
  )
}
