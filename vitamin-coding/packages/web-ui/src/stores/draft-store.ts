import { create } from 'zustand'

interface DraftState {
  drafts: Record<string, string>
  setDraft: (sessionId: string, content: string) => void
  getDraft: (sessionId: string) => string
  clearDraft: (sessionId: string) => void
}

export const useDraftStore = create<DraftState>((set, get) => ({
  drafts: {},
  setDraft: (sessionId, content) => {
    set((state) => ({ drafts: { ...state.drafts, [sessionId]: content } }))
  },
  getDraft: (sessionId) => get().drafts[sessionId] ?? '',
  clearDraft: (sessionId) => {
    set((state) => {
      const next = { ...state.drafts }
      delete next[sessionId]
      return { drafts: next }
    })
  },
}))
