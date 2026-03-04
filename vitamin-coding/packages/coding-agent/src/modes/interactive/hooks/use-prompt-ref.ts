import { useRef, useCallback } from 'react'

interface PromptRefHandle {
  focus: () => void
  blur: () => void
  set: (value: string) => void
  get: () => string
  clear: () => void
}

/**
 * Prompt ref management hook — provides imperative control over the prompt input.
 */
export function usePromptRef() {
  const ref = useRef<PromptRefHandle>({
    focus: () => {},
    blur: () => {},
    set: () => {},
    get: () => '',
    clear: () => {},
  })

  const register = useCallback((handle: PromptRefHandle) => {
    ref.current = handle
  }, [])

  return { ref: ref.current, register }
}
