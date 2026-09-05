'use client'

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'
import { API, getToken, setToken, clearToken } from '../api'
import type { AuthUser } from '../types'

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  setup: (email: string, password: string, displayName: string) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  loading: true,
  login: async () => {},
  setup: async () => {},
  logout: () => {},
  isAuthenticated: false,
})

type AuthMeResponse = {
  email: string
  display_name?: string
  access_role?: AuthUser['role']
}

async function restoreUserFromToken(token: string): Promise<AuthUser> {
  const response = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } })
  if (!response.ok) throw new Error('Session expired')
  const restored = await response.json() as AuthMeResponse
  return { id: '', email: restored.email, name: restored.display_name, role: restored.access_role }
}

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

    restoreUserFromToken(getToken() as string)
      .then(authUser => {
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
    const u: AuthUser = { id: '', email: res.email, name: res.display_name, role: res.access_role }
    setUser(u)
    localStorage.setItem('auth_user', JSON.stringify(u))
  }

  const setup = async (email: string, password: string, displayName: string) => {
    const res = await API.auth.setup({ email, password, display_name: displayName })
    setToken(res.token)
    const u: AuthUser = { id: '', email: res.email, name: res.display_name, role: res.access_role }
    setUser(u)
    localStorage.setItem('auth_user', JSON.stringify(u))
  }

  const logout = () => {
    void fetch('/api/auth/logout', { method: 'POST' })
    clearToken()
    setUser(null)
    localStorage.removeItem('auth_user')
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, setup, logout, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
