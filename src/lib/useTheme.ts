import { useCallback, useEffect, useState } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'theme'

const readInitial = (): Theme => {
  if (typeof document === 'undefined') return 'light'
  // The inline script in index.html has already set this before React mounted.
  const fromAttr = document.documentElement.dataset.theme
  if (fromAttr === 'light' || fromAttr === 'dark') return fromAttr
  return 'light'
}

export const useTheme = (): [Theme, (next: Theme) => void, () => void] => {
  const [theme, setThemeState] = useState<Theme>(readInitial)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      localStorage.setItem(STORAGE_KEY, theme)
    } catch {
      // ignore — private mode etc.
    }
  }, [theme])

  const setTheme = useCallback((next: Theme) => setThemeState(next), [])
  const toggle = useCallback(
    () => setThemeState((prev) => (prev === 'dark' ? 'light' : 'dark')),
    [],
  )

  return [theme, setTheme, toggle]
}
