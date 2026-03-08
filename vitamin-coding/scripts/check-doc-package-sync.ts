import { readdir, readFile } from 'node:fs/promises'
import { join, resolve } from 'node:path'

const rootDir = resolve(process.cwd())
const packagesDir = join(rootDir, 'packages')
const designDocPath = join(rootDir, 'docs/03-package-design.md')
const apiDocPath = join(rootDir, 'docs/api-reference.md')

function toPackageName(dirName: string): string {
  return `@vitamin/${dirName}`
}

function extractDesignPackages(content: string): Set<string> {
  const result = new Set<string>()
  const regex = /^###\s+3\.\d+\s+`(@vitamin\/[^`]+)`/gm
  let match: RegExpExecArray | null

  match = regex.exec(content)
  while (match) {
    result.add(match[1])
    match = regex.exec(content)
  }

  return result
}

function extractApiPackages(content: string): Set<string> {
  const result = new Set<string>()
  const regex = /^\|\s*`(@vitamin\/[^`]+)`\s*\|/gm
  let match: RegExpExecArray | null

  match = regex.exec(content)
  while (match) {
    result.add(match[1])
    match = regex.exec(content)
  }

  return result
}

function diff(expected: Set<string>, actual: Set<string>): { missing: string[]; extra: string[] } {
  const missing = [...expected].filter((name) => !actual.has(name)).sort()
  const extra = [...actual].filter((name) => !expected.has(name)).sort()
  return { missing, extra }
}

function printDiff(label: string, mismatch: { missing: string[]; extra: string[] }): void {
  if (mismatch.missing.length === 0 && mismatch.extra.length === 0) {
    console.log(`[ok] ${label}`)
    return
  }

  console.error(`[mismatch] ${label}`)
  if (mismatch.missing.length > 0) {
    console.error(`  missing: ${mismatch.missing.join(', ')}`)
  }
  if (mismatch.extra.length > 0) {
    console.error(`  extra: ${mismatch.extra.join(', ')}`)
  }
}

async function main(): Promise<void> {
  const packageDirs = (await readdir(packagesDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .map((entry) => toPackageName(entry.name))
    .sort()

  const packageSet = new Set(packageDirs)
  const designDoc = await readFile(designDocPath, 'utf8')
  const apiDoc = await readFile(apiDocPath, 'utf8')

  const designSet = extractDesignPackages(designDoc)
  const apiSet = extractApiPackages(apiDoc)

  const designDiff = diff(packageSet, designSet)
  const apiDiff = diff(packageSet, apiSet)

  printDiff('docs/03-package-design.md package sections', designDiff)
  printDiff('docs/api-reference.md package table', apiDiff)

  if (
    designDiff.missing.length > 0 ||
    designDiff.extra.length > 0 ||
    apiDiff.missing.length > 0 ||
    apiDiff.extra.length > 0
  ) {
    process.exitCode = 1
    return
  }

  console.log(`[ok] package count = ${packageDirs.length}`)
}

void main()
