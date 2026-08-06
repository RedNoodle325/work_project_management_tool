'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'

/** Protects pages that contain personal data, rather than merely edit controls. */
export function PrivateAuthGuard({ children }: { children: ReactNode }) {
  const router = useRouter()
  const { isAuthenticated, loading } = useAuth()

  useEffect(() => {
    if (!loading && !isAuthenticated) router.replace('/login')
  }, [isAuthenticated, loading, router])

  if (loading || !isAuthenticated) {
    return <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', color: 'var(--text3)' }}>Checking your session…</div>
  }

  return <>{children}</>
}
