// 资源加载器 — AGENTS.md / .vitamin/ / .rules/
import { readFile, readdir, stat } from 'node:fs/promises'
import { join, resolve } from 'node:path'

import { createLogger } from '@vitamin/shared'

import type { ProjectResources } from '../types'

const logger = createLogger('coding-agent:resource-loader')

// 安全读取文件（不存在则返回 null）
async function safeReadFile(path: string): Promise<string | null> {
  try {
    return await readFile(path, 'utf-8')
  } catch {
    return null
  }
}

// 安全列出目录中的 .md 文件
async function listMdFiles(dir: string): Promise<string[]> {
  try {
    const exists = await stat(dir)
      .then(() => true)
      .catch(() => false)
    if (!exists) return []

    const entries = await readdir(dir)
    const mdFiles: string[] = []

    for (const entry of entries) {
      if (entry.endsWith('.md')) {
        const content = await safeReadFile(join(dir, entry))
        if (content !== null) {
          mdFiles.push(content)
        }
      }
    }

    return mdFiles
  } catch {
    return []
  }
}

// 加载项目资源
export async function loadProjectResources(projectDir: string): Promise<ProjectResources> {
  const resolved = resolve(projectDir)

  // 1. 加载 AGENTS.md
  const agentsMd = await safeReadFile(join(resolved, 'AGENTS.md'))

  // 2. 加载 .rules/*.md
  const rules = await listMdFiles(join(resolved, '.rules'))

  // 3. 加载 .vitamin/plans/*.md
  const plans = await listMdFiles(join(resolved, '.vitamin', 'plans'))

  // 4. 列出扩展路径
  const extensions: string[] = []
  try {
    const extDir = join(resolved, '.vitamin', 'extensions')
    const exists = await stat(extDir).then(() => true).catch(() => false)
    if (exists) {
      const entries = await readdir(extDir)
      for (const entry of entries) {
        extensions.push(join(extDir, entry))
      }
    }
  } catch {
    // 忽略
  }

  logger.debug(
    'Resources loaded: AGENTS.md=%s, rules=%d, plans=%d',
    agentsMd !== null ? 'found' : 'not found',
    rules.length,
    plans.length,
  )

  return { agentsMd, rules, plans, extensions }
}

// 创建资源加载器工厂
export function createResourceLoader(projectDir: string) {
  return {
    load: () => loadProjectResources(projectDir),
    loadAgentsMd: () => safeReadFile(join(resolve(projectDir), 'AGENTS.md')),
    loadRules: () => listMdFiles(join(resolve(projectDir), '.rules')),
    loadPlans: () => listMdFiles(join(resolve(projectDir), '.vitamin', 'plans')),
  }
}
