import { useCallback, useEffect, useState } from 'react'

type Theme = 'light' | 'dark'

const STORAGE_KEY = 'wiki.theme'

function getSystemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function getStoredTheme(): Theme | null {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'light' || stored === 'dark' ? stored : null
}

interface UseThemeResult {
  theme: Theme
  toggleTheme: () => void
}

/** Defaults to the OS/browser preference; once the user toggles, that choice is persisted and wins. */
export function useTheme(): UseThemeResult {
  const [override, setOverride] = useState<Theme | null>(getStoredTheme)
  const [systemTheme, setSystemTheme] = useState<Theme>(getSystemTheme)

  useEffect(() => {
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const handler = () => setSystemTheme(mql.matches ? 'dark' : 'light')
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [])

  const theme = override ?? systemTheme

  // Tailwind's dark variant here is configured as `&:is(.dark *)` (class strategy),
  // so we keep the class in sync with the effective theme ourselves.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
  }, [theme])

  const toggleTheme = useCallback(() => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setOverride(next)
    localStorage.setItem(STORAGE_KEY, next)
  }, [theme])

  return { theme, toggleTheme }
}
