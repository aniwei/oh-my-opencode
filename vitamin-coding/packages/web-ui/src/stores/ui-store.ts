import { create } from 'zustand'

export type RightPanelTab = 'files' | 'agent'

interface UiState {
  leftSidebarOpen: boolean
  rightPanelOpen: boolean
  rightPanelTab: RightPanelTab
  toggleLeftSidebar: () => void
  toggleRightPanel: () => void
  setRightPanelTab: (tab: RightPanelTab) => void
}

export const useUiStore = create<UiState>((set) => ({
  leftSidebarOpen: true,
  rightPanelOpen: true,
  rightPanelTab: 'files',
  toggleLeftSidebar: () => set((state) => ({ leftSidebarOpen: !state.leftSidebarOpen })),
  toggleRightPanel: () => set((state) => ({ rightPanelOpen: !state.rightPanelOpen })),
  setRightPanelTab: (tab) => set({ rightPanelTab: tab }),
}))
