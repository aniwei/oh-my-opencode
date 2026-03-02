import { useCallback, useEffect } from 'react'

interface KeyBinding {
  key: string
  ctrl?: boolean
  meta?: boolean
  shift?: boolean
  handler: () => void
}

export function useKeyboard(bindings: KeyBinding[]) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    for (const binding of bindings) {
      const keyMatch = event.key.toLowerCase() === binding.key.toLowerCase()
      const ctrlMatch = binding.ctrl ? event.ctrlKey : !event.ctrlKey
      const metaMatch = binding.meta ? event.metaKey : !event.metaKey
      const shiftMatch = binding.shift ? event.shiftKey : true

      if (keyMatch && ctrlMatch && metaMatch && shiftMatch) {
        event.preventDefault()
        binding.handler()
        return
      }
    }
  }, [bindings])

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])
}
