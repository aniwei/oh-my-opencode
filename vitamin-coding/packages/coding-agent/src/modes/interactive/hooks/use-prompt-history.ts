import { useState, useCallback, useRef, useEffect } from 'react'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { homedir } from 'os'

const HISTORY_FILE = join(homedir(), '.config', 'opencode', 'prompt-history.json')
const MAX_ENTRIES = 500

/**
 * Prompt history hook — persists prompt history to disk with up/down navigation.
 */
export function usePromptHistory() {
  const [entries, setEntries] = useState<string[]>([])
  const [index, setIndex] = useState(-1)
  const loaded = useRef(false)

  useEffect(() => {
    if (loaded.current) return
    loaded.current = true

    readFile(HISTORY_FILE, 'utf-8')
      .then((data) => {
        const parsed = JSON.parse(data) as string[]
        setEntries(parsed)
      })
      .catch(() => {
        /* first run or corrupted — start fresh */
      })
  }, [])

  const save = useCallback(async (updated: string[]) => {
    try {
      await writeFile(HISTORY_FILE, JSON.stringify(updated.slice(-MAX_ENTRIES)), 'utf-8')
    } catch {
      /* non-critical — ignore write failures */
    }
  }, [])

  const push = useCallback(
    (input: string) => {
      const trimmed = input.trim()
      if (trimmed.length === 0) return

      setEntries((prev) => {
        const deduped = prev.filter((e) => e !== trimmed)
        const updated = [...deduped, trimmed]
        void save(updated)
        return updated
      })
      setIndex(-1)
    },
    [save],
  )

  const goUp = useCallback((): string | undefined => {
    if (entries.length === 0) return undefined
    const nextIndex = index === -1 ? entries.length - 1 : Math.max(0, index - 1)
    setIndex(nextIndex)
    return entries[nextIndex]
  }, [entries, index])

  const goDown = useCallback((): string | undefined => {
    if (index === -1) return undefined
    const nextIndex = index + 1
    if (nextIndex >= entries.length) {
      setIndex(-1)
      return ''
    }
    setIndex(nextIndex)
    return entries[nextIndex]
  }, [entries, index])

  const reset = useCallback(() => {
    setIndex(-1)
  }, [])

  return { entries, push, goUp, goDown, reset }
}
