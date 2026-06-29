import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

type Theme = 'dark' | 'light'

interface ThemeContextValue {
  theme: Theme
  toggle: () => void
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'dark', toggle: () => {} })

export function ThemeProvider({ children }: { children: ReactNode }) {
  // Keep the server render and first client render identical. Browser preferences
  // are restored after hydration to avoid React hydration mismatches.
  const [theme, setTheme] = useState<Theme>('dark')

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const stored = localStorage.getItem('theme')
      const restored: Theme = stored === 'light' ? 'light' : 'dark'
      setTheme(restored)
      document.documentElement.setAttribute('data-theme', restored)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const toggle = () => setTheme(current => {
    const next = current === 'dark' ? 'light' : 'dark'
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('theme', next)
    return next
  })

  return (
    <ThemeContext.Provider value={{ theme, toggle }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  return useContext(ThemeContext)
}
