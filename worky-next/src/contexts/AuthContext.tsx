import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { API, getToken, setToken, clearToken } from '../api'
import type { AuthUser } from '../types'

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  login: async () => {},
  logout: () => {},
  isAuthenticated: false,
})

export function AuthProvider({ children }: { children: ReactNode }) {
  // Authentication is restored in the effect so the initial client markup
  // always matches the server-rendered markup.
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!getToken()) {
      localStorage.removeItem('auth_user')
      const loadingTimer = window.setTimeout(() => setLoading(false), 0)
      return () => window.clearTimeout(loadingTimer)
    }

    const restoreTimer = window.setTimeout(() => {
      try {
        const stored = localStorage.getItem('auth_user')
        if (stored && stored !== 'undefined' && stored !== 'null') {
          setUser(JSON.parse(stored))
        }
      } catch {
        localStorage.removeItem('auth_user')
      }
    }, 0)

    API.auth.me()
      .then(u => {
        const authUser: AuthUser = { id: '', email: (u as {email:string}).email, name: (u as {display_name?:string}).display_name }
        setUser(authUser)
        localStorage.setItem('auth_user', JSON.stringify(authUser))
      })
      .catch(() => { clearToken(); setUser(null) })
      .finally(() => setLoading(false))

    return () => window.clearTimeout(restoreTimer)
  }, [])

  const login = async (email: string, password: string) => {
    const res = await API.auth.login(email, password)
    setToken(res.token)
    const u: AuthUser = { id: '', email: res.email, name: res.display_name }
    setUser(u)
    localStorage.setItem('auth_user', JSON.stringify(u))
  }

  const logout = () => {
    clearToken()
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
