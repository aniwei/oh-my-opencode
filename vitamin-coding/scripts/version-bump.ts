// 版本号批量更新脚本 — 同步所有包的 version 字段
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join, resolve } from 'node:path'

const ROOT_DIR = resolve(import.meta.dirname, '..')
const PACKAGES_DIR = join(ROOT_DIR, 'packages')

function getNewVersion(): string {
  const arg = process.argv[2]
  if (!arg) {
    console.error('Usage: tsx scripts/version-bump.ts <version>')
    console.error('Example: tsx scripts/version-bump.ts 0.1.0')
    process.exit(1)
  }

  // 验证 semver 格式
  if (!/^\d+\.\d+\.\d+(-[\w.]+)?$/.test(arg)) {
    console.error(`Invalid semver: ${arg}`)
    process.exit(1)
  }

  return arg
}

function getPackageDirs(): string[] {
  return readdirSync(PACKAGES_DIR)
    .filter((name) => {
      const pkgJsonPath = join(PACKAGES_DIR, name, 'package.json')
      try {
        statSync(pkgJsonPath)
        return true
      } catch {
        return false
      }
    })
    .map((name) => join(PACKAGES_DIR, name))
}

function updatePackageVersion(pkgDir: string, version: string): string {
  const pkgJsonPath = join(pkgDir, 'package.json')
  const content = readFileSync(pkgJsonPath, 'utf-8')
  const pkg = JSON.parse(content) as Record<string, unknown>

  const oldVersion = pkg['version'] as string
  pkg['version'] = version

  // 也更新 workspace 依赖的版本范围（可选）
  for (const depType of ['dependencies', 'devDependencies', 'peerDependencies']) {
    const deps = pkg[depType] as Record<string, string> | undefined
    if (!deps) continue
    for (const [name, range] of Object.entries(deps)) {
      if (name.startsWith('@vitamin/') && range.startsWith('workspace:')) {
        // workspace 协议不需要更新，pnpm 自动处理
      }
    }
  }

  writeFileSync(pkgJsonPath, JSON.stringify(pkg, null, 2) + '\n')
  return oldVersion
}

// 执行
const newVersion = getNewVersion()
const packageDirs = getPackageDirs()

console.log(`Bumping version to ${newVersion} across ${packageDirs.length} packages...\n`)

for (const dir of packageDirs) {
  const pkgName = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf-8')).name as string
  const oldVersion = updatePackageVersion(dir, newVersion)
  console.log(`  ${pkgName}: ${oldVersion} → ${newVersion}`)
}

console.log(`\nDone. ${packageDirs.length} packages updated to ${newVersion}.`)
