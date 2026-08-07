'use client'

import { useEffect, type ReactNode } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { Layout } from './Layout'

export function AuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter()
  const path = usePathname()
  const { isAuthenticated, loading, user } = useAuth()

  useEffect(() => {
    if (loading) return
    if (!isAuthenticated) {
      router.replace(`/login?next=${encodeURIComponent(path)}`)
      return
    }
    if (user?.role === 'scheduler') router.replace('/scheduler')
  }, [isAuthenticated, loading, path, router, user?.role])

  if (loading || !isAuthenticated || user?.role === 'scheduler') {
    return (
      <div className="x-state">
        <div className="x-brand-line" />
        <h1>Checking your session...</h1>
        <p>Zaktrack is confirming your access before opening the workspace.</p>
      </div>
    )
  }

  return <Layout>{children}</Layout>
}
