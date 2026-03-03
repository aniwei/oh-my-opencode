import { createContext } from 'react'

export interface RouterContextValue {
  currentPath: string
  setCurrentPath: ((to: string) => void) | null
  params: Record<string, string>
}

export const Context = createContext<RouterContextValue>({
  currentPath: '/',
  setCurrentPath: null,
  params: {},
})