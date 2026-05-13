import { useEffect, useState } from 'react'

export type ThemeMode = 'light' | 'dark'

const DEFAULT_MODE: ThemeMode = 'dark'

function getInitialMode(): ThemeMode {
  if (typeof window === 'undefined') {
    return DEFAULT_MODE
  }

  const stored = window.localStorage.getItem('theme')
  if (stored === 'light' || stored === 'dark') {
    return stored
  }

  return DEFAULT_MODE
}

function applyThemeMode(mode: ThemeMode) {
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add(mode)
  root.style.colorScheme = mode
}

export function useTheme() {
  const [mode, setMode] = useState<ThemeMode>(DEFAULT_MODE)

  useEffect(() => {
    const initial = getInitialMode()
    setMode(initial)
    applyThemeMode(initial)
  }, [])

  function toggle() {
    const next: ThemeMode = mode === 'dark' ? 'light' : 'dark'
    setMode(next)
    applyThemeMode(next)
    window.localStorage.setItem('theme', next)
  }

  return { mode, toggle }
}
