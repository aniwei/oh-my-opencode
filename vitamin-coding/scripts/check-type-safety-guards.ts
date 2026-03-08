import { readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'
import { readdir } from 'node:fs/promises'

const rootDir = resolve(process.cwd())
const packagesDir = join(rootDir, 'packages')

const FORBIDDEN_PATTERNS = [
  { name: 'as any', regex: /\bas\s+any\b/g },
  { name: '@ts-ignore', regex: /@ts-ignore/g },
  { name: '@ts-expect-error', regex: /@ts-expect-error/g },
  { name: 'empty catch block', regex: /catch\s*\([^)]*\)\s*\{\s*\}/g },
]

const DEBT_PATTERNS = [
  { name: 'unknown as', regex: /\bunknown\s+as\b/g },
]

const strictUnknownAs = process.argv.includes('--strict-unknown-as')

async function walk(dir: string): Promise<string[]> {
  const entries = await readdir(dir, { withFileTypes: true })
  const files: string[] = []

  for (const entry of entries) {
    const fullPath = join(dir, entry.name)
    if (entry.isDirectory()) {
      files.push(...(await walk(fullPath)))
      continue
    }

    if (entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) {
      files.push(fullPath)
    }
  }

  return files
}

async function main(): Promise<void> {
  const files = await walk(packagesDir)
  const violations: Array<{ file: string; rule: string; line: number; text: string }> = []
  const debt: Array<{ file: string; rule: string; line: number; text: string }> = []

  for (const file of files) {
    const text = await readFile(file, 'utf8')
    const lines = text.split('\n')

    lines.forEach((line, index) => {
      for (const pattern of FORBIDDEN_PATTERNS) {
        if (pattern.regex.test(line)) {
          violations.push({
            file: file.replace(`${rootDir}/`, ''),
            rule: pattern.name,
            line: index + 1,
            text: line.trim(),
          })
        }
        pattern.regex.lastIndex = 0
      }

      for (const pattern of DEBT_PATTERNS) {
        if (pattern.regex.test(line)) {
          debt.push({
            file: file.replace(`${rootDir}/`, ''),
            rule: pattern.name,
            line: index + 1,
            text: line.trim(),
          })
        }
        pattern.regex.lastIndex = 0
      }
    })
  }

  if (violations.length === 0) {
    console.log('[ok] type safety guard check passed')
  } else {
    console.error(`[mismatch] found ${violations.length} forbidden type-safety patterns`)
    for (const violation of violations) {
      console.error(`  - ${violation.file}:${violation.line} [${violation.rule}] ${violation.text}`)
    }
  }

  if (debt.length > 0) {
    console.warn(`[warn] found ${debt.length} technical-debt patterns (unknown as)`)
    for (const item of debt.slice(0, 20)) {
      console.warn(`  - ${item.file}:${item.line} [${item.rule}] ${item.text}`)
    }
    if (debt.length > 20) {
      console.warn(`  ... ${debt.length - 20} more`)
    }
  }

  if (violations.length > 0) {
    process.exitCode = 1
    return
  }

  if (strictUnknownAs && debt.length > 0) {
    console.error('[mismatch] strict unknown-as mode enabled and debt patterns exist')
    process.exitCode = 1
  }
}

void main()
