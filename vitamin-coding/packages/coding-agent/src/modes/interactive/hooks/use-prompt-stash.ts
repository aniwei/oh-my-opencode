import { useState, useCallback } from 'react'

/**
 * Prompt stash — save/restore prompt text for later use.
 * Useful when user wants to temporarily switch context and come back.
 */
export function usePromptStash() {
  const [stash, setStash] = useState<string[]>([])

  const push = useCallback((text: string) => {
    const trimmed = text.trim()
    if (trimmed.length === 0) return
    setStash((prev) => [...prev, trimmed])
  }, [])

  const pop = useCallback((): string | undefined => {
    let popped: string | undefined
    setStash((prev) => {
      if (prev.length === 0) return prev
      popped = prev[prev.length - 1]
      return prev.slice(0, -1)
    })
    return popped
  }, [])

  const peek = useCallback((): string | undefined => {
    return stash[stash.length - 1]
  }, [stash])

  const clear = useCallback(() => {
    setStash([])
  }, [])

  return { stash, push, pop, peek, clear, count: stash.length }
}
