import { structuredPatch } from 'diff'

export interface DiffLine {
  type: 'added' | 'removed' | 'context' | 'header'
  content: string
  prefix: string
}

/**
 * Generate diff lines from two text strings, suitable for terminal display.
 */
export function createDiffLines(oldText: string, newText: string): DiffLine[] {
  const patch = structuredPatch('old', 'new', oldText, newText, '', '', {
    context: 3,
  })

  const lines: DiffLine[] = []

  for (const hunk of patch.hunks) {
    lines.push({
      type: 'header',
      content: `@@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@`,
      prefix: '',
    })

    for (const line of hunk.lines) {
      if (line.startsWith('+')) {
        lines.push({ type: 'added', content: line.slice(1), prefix: '+' })
      } else if (line.startsWith('-')) {
        lines.push({ type: 'removed', content: line.slice(1), prefix: '-' })
      } else {
        lines.push({ type: 'context', content: line.slice(1), prefix: ' ' })
      }
    }
  }

  return lines
}
