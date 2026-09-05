'use client'

import type { ReactNode } from 'react'
import { Layout } from './Layout'
import { Login } from '@/pages-impl/Login'
import { useAuth } from '@/contexts/AuthContext'

export function AuthGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth()
  if (loading) return <main className="x-auth-loading">Loading workspace…</main>
  if (!isAuthenticated) return <Login />
  return <Layout>{children}</Layout>
}
