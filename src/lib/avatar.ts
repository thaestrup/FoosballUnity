// Static avatar lookup. Backend has no photo storage today (logged in
// FINDINGS-backend.md → "Photo storage / edit mode"); avatars are bundled
// JPEGs under /img/ keyed by lowercase, hyphen-separated name.

export const avatarUrl = (name: string) => {
  return `/img/${name.toLowerCase().replace(/\s+/g, '-')}.jpg`
}

export const FALLBACK_AVATAR = '/img/Wildcard.jpg'
