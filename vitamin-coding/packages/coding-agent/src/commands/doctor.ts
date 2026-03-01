// `vitamin doctor` — 环境健康检查
import { join } from 'node:path'
import { access } from 'node:fs/promises'

import { createLogger } from '@vitamin/shared'

const logger = createLogger('coding-agent:cmd:doctor')

// 检查项结果
export interface CheckResult {
  name: string
  status: 'pass' | 'warn' | 'fail'
  message: string
}

// 环境检测列表
const CHECKS: Array<{
  name: string
  check: (projectDir: string) => Promise<CheckResult>
}> = [
  {
    name: 'Node.js Version',
    check: async () => {
      const version = process.version
      const major = Number(version.slice(1).split('.')[0])
      return {
        name: 'Node.js Version',
        status: major >= 22 ? 'pass' : major >= 20 ? 'warn' : 'fail',
        message: major >= 22
          ? `${version} (recommended)`
          : major >= 20
            ? `${version} (works, but >=22 recommended)`
            : `${version} (requires >=22.0.0)`,
      }
    },
  },
  {
    name: 'Anthropic API Key',
    check: async () => {
      const key = process.env['ANTHROPIC_API_KEY']
      return {
        name: 'Anthropic API Key',
        status: key ? 'pass' : 'warn',
        message: key ? 'Set (sk-...redacted)' : 'Not set — Anthropic models will not work',
      }
    },
  },
  {
    name: 'OpenAI API Key',
    check: async () => {
      const key = process.env['OPENAI_API_KEY']
      return {
        name: 'OpenAI API Key',
        status: key ? 'pass' : 'warn',
        message: key ? 'Set (redacted)' : 'Not set — OpenAI models will not work',
      }
    },
  },
  {
    name: 'Google API Key',
    check: async () => {
      const key = process.env['GOOGLE_API_KEY'] ?? process.env['GEMINI_API_KEY']
      return {
        name: 'Google API Key',
        status: key ? 'pass' : 'warn',
        message: key ? 'Set (redacted)' : 'Not set — Gemini models will not work',
      }
    },
  },
  {
    name: 'Project Config',
    check: async (projectDir) => {
      const configPath = join(projectDir, '.vitamin', 'config.json')
      try {
        await access(configPath)
        return { name: 'Project Config', status: 'pass', message: `.vitamin/config.json found` }
      } catch {
        return { name: 'Project Config', status: 'warn', message: 'No .vitamin/config.json — using defaults' }
      }
    },
  },
  {
    name: 'AGENTS.md',
    check: async (projectDir) => {
      const agentsPath = join(projectDir, 'AGENTS.md')
      try {
        await access(agentsPath)
        return { name: 'AGENTS.md', status: 'pass', message: 'Found — will be injected into system prompt' }
      } catch {
        return { name: 'AGENTS.md', status: 'warn', message: 'Not found — consider adding project context' }
      }
    },
  },
  {
    name: 'Git Repository',
    check: async (projectDir) => {
      const gitPath = join(projectDir, '.git')
      try {
        await access(gitPath)
        return { name: 'Git Repository', status: 'pass', message: 'Git repository detected' }
      } catch {
        return { name: 'Git Repository', status: 'warn', message: 'Not a git repository' }
      }
    },
  },
]

// 状态图标
const STATUS_ICONS: Record<CheckResult['status'], string> = {
  pass: '\u2714',
  warn: '\u26A0',
  fail: '\u2718',
}

// 状态颜色 (ANSI)
const STATUS_COLORS: Record<CheckResult['status'], string> = {
  pass: '\x1b[32m',
  warn: '\x1b[33m',
  fail: '\x1b[31m',
}

const RESET = '\x1b[0m'

// 执行所有健康检查
export async function executeDoctorCommand(projectDir: string): Promise<void> {
  logger.info('Running doctor checks for project: %s', projectDir)

  process.stdout.write('\nvitamin doctor — Environment Health Check\n')
  process.stdout.write('─'.repeat(50) + '\n\n')

  const results: CheckResult[] = []

  for (const { check } of CHECKS) {
    const result = await check(projectDir)
    results.push(result)

    const icon = STATUS_ICONS[result.status]
    const statusColor = STATUS_COLORS[result.status]
    process.stdout.write(
      `  ${statusColor}${icon}${RESET}  ${result.name.padEnd(22)} ${result.message}\n`
    )
  }

  process.stdout.write('\n' + '─'.repeat(50) + '\n')

  const passCount = results.filter(r => r.status === 'pass').length
  const warnCount = results.filter(r => r.status === 'warn').length
  const failCount = results.filter(r => r.status === 'fail').length

  process.stdout.write(
    `  ${passCount} passed, ${warnCount} warnings, ${failCount} failures\n\n`
  )

  if (failCount > 0) {
    process.exitCode = 1
  }
}

// 创建 doctor 命令帮助
export function createDoctorCommandHelp(): string {
  return `
vitamin doctor — Check environment health

Checks:
  - Node.js version (>=22.0.0 required)
  - API keys (Anthropic, OpenAI, Google)
  - Project configuration
  - AGENTS.md presence
  - Git repository status

Usage:
  vitamin doctor
`.trim()
}
