import { createContext, useContext, useReducer, type ReactNode } from 'react'
import { uiReducer, initialState } from './reducer.js'
import type { UIState } from './types.js'
import type { UIAction } from './actions.js'

interface AppContextValue {
  state: UIState
  dispatch: React.Dispatch<UIAction>
}

const AppContext = createContext<AppContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(uiReducer, initialState)

  return (
    <AppContext.Provider value={{ state, dispatch }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext)
  if (!ctx) {
    throw new Error('useApp must be used within <AppProvider>')
  }
  return ctx
}
