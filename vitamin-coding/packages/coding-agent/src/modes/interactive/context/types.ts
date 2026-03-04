import type { ReactNode } from 'react'

export interface DialogEntry {
  id: string
  element: ReactNode
  onClose?: () => void
}

export interface ToastOptions {
  message: string
  type: 'info' | 'success' | 'error' | 'warning'
  duration?: number
}

export interface UIState {
  /** Dialog stack — top of stack is the visible dialog */
  dialog: {
    stack: DialogEntry[]
    size: 'medium' | 'large'
  }

  /** Current toast notification (single) */
  toast: ToastOptions | null

  /** Whether side panel is expanded */
  sidebarOpen: boolean

  /** Prompt input mode */
  promptMode: 'normal' | 'shell' | 'search'

  /** Whether the prompt area has focus */
  promptFocused: boolean

  /** Whether auto-scroll is locked to bottom */
  scrollLocked: boolean
}
