'use client'

import { Login } from '@/pages-impl/Login'
import { useAuth } from '@/contexts/AuthContext'
import { useRouter } from 'next/navigation'
import { useSearchParams } from 'next/navigation'
import { Suspense, useEffect } from 'react'

export default function LoginPage() {
  return <Suspense fallback={<Login />}><LoginPageContent /></Suspense>
}

function LoginPageContent() {
  const { user, isAuthenticated, loading } = useAuth()
  const router = useRouter()
  const searchParams = useSearchParams()
  const schedulerLogin = searchParams.get('mode') === 'scheduler'

  useEffect(() => {
    if (!loading && isAuthenticated) router.replace(user?.role === 'scheduler' ? '/employee-scheduler' : '/sites')
  }, [isAuthenticated, loading, router, user?.role])

  return <Login schedulerLogin={schedulerLogin} />
}
