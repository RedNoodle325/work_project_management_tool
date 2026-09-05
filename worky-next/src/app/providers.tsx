'use client'

import { createContext, useContext, type ReactNode } from 'react'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { EditModeProvider } from '@/contexts/EditModeContext'
import { useToast } from '@/hooks/useToast'
import { ToastContainer } from '@/components/Toast'
import { AuthProvider } from '@/contexts/AuthContext'

type ToastFn = (message: string, type?: 'success' | 'error' | 'info') => void

export const ToastContext = createContext<ToastFn>(() => {})

export function useToastFn(): ToastFn {
  return useContext(ToastContext)
}

function InnerProviders({ children }: { children: ReactNode }) {
  const { toasts, toast, dismiss } = useToast()
  return (
    <ToastContext.Provider value={toast}>
      {children}
      <ToastContainer toasts={toasts} dismiss={dismiss} />
    </ToastContext.Provider>
  )
}

export function Providers({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider>
      <AuthProvider>
        <EditModeProvider>
          <InnerProviders>{children}</InnerProviders>
        </EditModeProvider>
      </AuthProvider>
    </ThemeProvider>
  )
}
