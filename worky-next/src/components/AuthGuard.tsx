'use client'

import type { ReactNode } from 'react'
import { Layout } from './Layout'

export function AuthGuard({ children }: { children: ReactNode }) {
  return <Layout>{children}</Layout>
}
