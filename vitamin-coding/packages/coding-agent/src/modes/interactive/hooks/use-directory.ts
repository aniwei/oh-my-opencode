import { useMemo } from 'react'
import { basename } from 'path'

/**
 * Directory display hook — returns a formatted version of the current working directory.
 */
export function useDirectory(cwd?: string): string {
  return useMemo(() => {
    const dir = cwd ?? process.cwd()
    return basename(dir) || dir
  }, [cwd])
}
