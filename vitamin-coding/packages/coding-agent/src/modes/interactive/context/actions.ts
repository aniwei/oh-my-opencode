import type { DialogEntry, ToastOptions, UIState } from './types.js'

export type UIAction =
  // ─── Dialog ───
  | { type: 'dialog/push'; entry: DialogEntry }
  | { type: 'dialog/pop' }
  | { type: 'dialog/clear' }
  | { type: 'dialog/setSize'; size: 'medium' | 'large' }
  // ─── Toast ───
  | { type: 'toast/show'; toast: ToastOptions }
  | { type: 'toast/dismiss' }
  // ─── Sidebar ───
  | { type: 'sidebar/toggle' }
  | { type: 'sidebar/set'; open: boolean }
  // ─── Prompt ───
  | { type: 'prompt/setMode'; mode: UIState['promptMode'] }
  | { type: 'prompt/setFocused'; focused: boolean }
  // ─── Scroll ───
  | { type: 'scroll/lock'; locked: boolean }
