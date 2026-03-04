import { useCallback } from 'react'
import { useInput } from 'ink'

/**
 * Exit hook — handles Ctrl+C and Ctrl+D to exit the application.
 */
export function useExit(onExit: () => void) {
  useInput(useCallback(
    (input: string, key: { ctrl: boolean }) => {
      if ((input === 'c' || input === 'd') && key.ctrl) {
        onExit()
      }
    },
    [onExit],
  ))
}
