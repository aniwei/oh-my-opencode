import { useCallback, useRef } from 'react'
import { useInput } from 'ink'

interface KeybindDef {
  key: string
  ctrl?: boolean
  meta?: boolean
  shift?: boolean
  action: () => void
}

/**
 * Keybind matching hook — registers keyboard shortcuts and dispatches actions.
 *
 * Supports Ctrl+X leader key sequences: pressing Ctrl+X enters "leader mode",
 * and the next keypress determines the action.
 */
export function useKeybind(keybinds: KeybindDef[], isActive = true) {
  const leaderMode = useRef(false)
  const leaderTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearLeader = useCallback(() => {
    leaderMode.current = false
    if (leaderTimeout.current != null) {
      clearTimeout(leaderTimeout.current)
      leaderTimeout.current = null
    }
  }, [])

  useInput(
    (input, key) => {
      if (leaderMode.current) {
        clearLeader()
        const match = keybinds.find(
          (kb) =>
            kb.key.toLowerCase() === input.toLowerCase() &&
            !kb.ctrl &&
            !kb.meta,
        )
        if (match != null) {
          match.action()
        }
        return
      }

      if (input === 'x' && key.ctrl) {
        leaderMode.current = true
        leaderTimeout.current = setTimeout(clearLeader, 1000)
        return
      }

      const match = keybinds.find(
        (kb) =>
          kb.key.toLowerCase() === input.toLowerCase() &&
          (kb.ctrl ?? false) === key.ctrl &&
          (kb.meta ?? false) === key.meta,
      )
      if (match != null) {
        match.action()
      }
    },
    { isActive },
  )
}
