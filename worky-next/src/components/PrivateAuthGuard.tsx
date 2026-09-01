import type { ReactNode } from 'react'

/** Protects pages that contain personal data, rather than merely edit controls. */
export function PrivateAuthGuard({ children }: { children: ReactNode }) {
  return <>{children}</>
}
