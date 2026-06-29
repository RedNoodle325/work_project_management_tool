import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

interface EditModeContextValue {
  editMode: boolean
  toggleEditMode: () => void
}

const EditModeContext = createContext<EditModeContextValue>({
  editMode: true,
  toggleEditMode: () => {},
})

export function EditModeProvider({ children }: { children: ReactNode }) {
  // Use the same initial value on the server and client, then restore the
  // persisted browser setting after hydration.
  const [editMode, setEditMode] = useState(true)

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const restored = localStorage.getItem('munters-edit-mode') !== 'off'
      setEditMode(restored)
      document.body.classList.toggle('read-only', !restored)
    }, 0)
    return () => window.clearTimeout(timer)
  }, [])

  const toggleEditMode = () => setEditMode(current => {
    const next = !current
    localStorage.setItem('munters-edit-mode', next ? 'on' : 'off')
    document.body.classList.toggle('read-only', !next)
    return next
  })

  return (
    <EditModeContext.Provider value={{ editMode, toggleEditMode }}>
      {children}
    </EditModeContext.Provider>
  )
}

export function useEditMode() {
  return useContext(EditModeContext)
}
