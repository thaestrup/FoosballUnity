import { avatarUrl, FALLBACK_AVATAR } from '@/lib/avatar'

type Props = {
  name: string
  className?: string
}

export const Avatar = ({ name, className }: Props) => {
  return (
    <img
      src={avatarUrl(name)}
      alt=""
      className={className}
      loading="lazy"
      decoding="async"
      onError={(e) => {
        e.currentTarget.src = FALLBACK_AVATAR
      }}
    />
  )
}
