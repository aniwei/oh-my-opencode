import type { UIState } from './types.js'
import type { UIAction } from './actions.js'

export const initialState: UIState = {
  dialog: { stack: [], size: 'medium' },
  toast: null,
  sidebarOpen: false,
  promptMode: 'normal',
  promptFocused: true,
  scrollLocked: true,
}

export function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case 'dialog/push':
      return {
        ...state,
        dialog: {
          ...state.dialog,
          stack: [...state.dialog.stack, action.entry],
        },
      }
    case 'dialog/pop': {
      const stack = [...state.dialog.stack]
      const removed = stack.pop()
      removed?.onClose?.()
      return { ...state, dialog: { ...state.dialog, stack } }
    }
    case 'dialog/clear':
      return { ...state, dialog: { ...state.dialog, stack: [] } }
    case 'dialog/setSize':
      return { ...state, dialog: { ...state.dialog, size: action.size } }
    case 'toast/show':
      return { ...state, toast: action.toast }
    case 'toast/dismiss':
      return { ...state, toast: null }
    case 'sidebar/toggle':
      return { ...state, sidebarOpen: !state.sidebarOpen }
    case 'sidebar/set':
      return { ...state, sidebarOpen: action.open }
    case 'prompt/setMode':
      return { ...state, promptMode: action.mode }
    case 'prompt/setFocused':
      return { ...state, promptFocused: action.focused }
    case 'scroll/lock':
      return { ...state, scrollLocked: action.locked }
    default:
      return state
  }
}
