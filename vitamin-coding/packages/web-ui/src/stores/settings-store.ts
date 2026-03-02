import { create } from 'zustand'

export type SendShortcut = 'enter' | 'cmd-enter'
export type ColorScheme = 'light' | 'dark'

const THEME_KEY = 'vitamin.webui.theme'
const SHORTCUT_KEY = 'vitamin.webui.shortcut'
const MODEL_KEY = 'vitamin.webui.model'

function readColorScheme(): ColorScheme {
  if (typeof localStorage === 'undefined') {
    return 'dark'
  }

  const value = localStorage.getItem(THEME_KEY)
  return value === 'light' ? 'light' : 'dark'
}

function readShortcut(): SendShortcut {
  if (typeof localStorage === 'undefined') {
    return 'cmd-enter'
  }

  const value = localStorage.getItem(SHORTCUT_KEY)
  return value === 'enter' ? 'enter' : 'cmd-enter'
}

function readModelId(): string {
  if (typeof localStorage === 'undefined') {
    return 'claude-sonnet-4'
  }

  return localStorage.getItem(MODEL_KEY) ?? 'claude-sonnet-4'
}

interface SettingsState {
  colorScheme: ColorScheme
  sendShortcut: SendShortcut
  defaultModelId: string
  setColorScheme: (value: ColorScheme) => void
  setSendShortcut: (value: SendShortcut) => void
  setDefaultModelId: (value: string) => void
}

export const useSettingsStore = create<SettingsState>((set) => ({
  colorScheme: readColorScheme(),
  sendShortcut: readShortcut(),
  defaultModelId: readModelId(),
  setColorScheme: (value) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(THEME_KEY, value)
    }
    set({ colorScheme: value })
  },
  setSendShortcut: (value) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(SHORTCUT_KEY, value)
    }
    set({ sendShortcut: value })
  },
  setDefaultModelId: (value) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(MODEL_KEY, value)
    }
    set({ defaultModelId: value })
  },
}))
