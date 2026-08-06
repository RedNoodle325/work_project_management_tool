'use client'

import { useEffect, type ReactNode } from 'react'
import { useRouter } from 'next/navigation'
import { Layout } from './Layout'
import { useAuth } from '@/contexts/AuthContext'

export function AuthGuard({ children }: { children: ReactNode }) {
  const { isAuthenticated, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && !isAuthenticated) router.replace('/login')
  }, [isAuthenticated, loading, router])

  if (loading) {
    return (
      <Layout>
        <div className="x-state">
          <div className="x-brand-line" />
          <h1>Checking access</h1>
          <p>Loading your XNRGY workspace session.</p>
        </div>
      </Layout>
    )
  }

  if (!isAuthenticated) {
    return (
      <Layout>
        <div className="x-state">
          <div className="x-brand-line" />
          <h1>Sign in required</h1>
          <p>Redirecting to login.</p>
        </div>
      </Layout>
    )
  }

  return <Layout>{children}</Layout>
}
