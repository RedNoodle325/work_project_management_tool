'use client'

import { Login } from '@/pages-impl/Login'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useEffect } from 'react'

export default function LoginPage() {
  const { user, isAuthenticated, loading } = useAuth()
  const router = useRouter()

  useEffect(() => {
    if (!loading && isAuthenticated) router.replace(user?.role === 'scheduler' ? '/employee-scheduler' : '/sites')
  }, [isAuthenticated, loading, router, user?.role])

  return <Login />
}
