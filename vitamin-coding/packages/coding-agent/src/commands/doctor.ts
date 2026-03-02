import { access } from 'node:fs/promises'
// `vitamin doctor` — 环境健康检查
import { join } from 'node:path'

import { createLogger } from '@vitamin/shared'

import { readStoredCopilotAuth } from './auth'

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
    name: 'Node.js 版本',
    check: async () => {
      const version = process.version
      const major = Number(version.slice(1).split('.')[0])
      return {
        name: 'Node.js 版本',
        status: major >= 22 ? 'pass' : major >= 20 ? 'warn' : 'fail',
        message:
          major >= 22
            ? `${version}（推荐）`
            : major >= 20
              ? `${version}（可用，但建议 >=22）`
              : `${version}（需要 >=22.0.0）`,
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
        message: key ? '已设置（sk-...已隐藏）' : '未设置 — Anthropic 模型不可用',
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
        message: key ? '已设置（已隐藏）' : '未设置 — OpenAI 模型不可用',
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
        message: key ? '已设置（已隐藏）' : '未设置 — Gemini 模型不可用',
      }
    },
  },
  {
    name: 'GitHub Copilot Token',
    check: async () => {
      const key = process.env['GITHUB_TOKEN']
      const stored = key ? undefined : await readStoredCopilotAuth()
      const ok = !!key || !!stored
      return {
        name: 'GitHub Copilot Token',
        status: ok ? 'pass' : 'warn',
        message: ok
          ? key
            ? '已设置（环境变量）'
            : '已设置（本地 OAuth 存储）'
          : '未设置 — Copilot 模型不可用',
      }
    },
  },
  {
    name: '项目配置',
    check: async (projectDir) => {
      const configPath = join(projectDir, '.vitamin', 'config.json')
      try {
        await access(configPath)
        return { name: '项目配置', status: 'pass', message: `已找到 .vitamin/config.json` }
      } catch {
        return {
          name: '项目配置',
          status: 'warn',
          message: '未找到 .vitamin/config.json — 将使用默认配置',
        }
      }
    },
  },
  {
    name: 'AGENTS.md',
    check: async (projectDir) => {
      const agentsPath = join(projectDir, 'AGENTS.md')
      try {
        await access(agentsPath)
        return {
          name: 'AGENTS.md',
          status: 'pass',
          message: '已找到 — 将注入系统提示词',
        }
      } catch {
        return {
          name: 'AGENTS.md',
          status: 'warn',
          message: '未找到 — 建议补充项目上下文',
        }
      }
    },
  },
  {
    name: 'Git 仓库',
    check: async (projectDir) => {
      const gitPath = join(projectDir, '.git')
      try {
        await access(gitPath)
        return { name: 'Git 仓库', status: 'pass', message: '已检测到 Git 仓库' }
      } catch {
        return { name: 'Git 仓库', status: 'warn', message: '当前目录不是 Git 仓库' }
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

  process.stdout.write('\nvitamin doctor — 环境健康检查\n')
  process.stdout.write('─'.repeat(50) + '\n\n')

  const results: CheckResult[] = []

  for (const { check } of CHECKS) {
    const result = await check(projectDir)
    results.push(result)

    const icon = STATUS_ICONS[result.status]
    const statusColor = STATUS_COLORS[result.status]
    process.stdout.write(
      `  ${statusColor}${icon}${RESET}  ${result.name.padEnd(22)} ${result.message}\n`,
    )
  }

  process.stdout.write('\n' + '─'.repeat(50) + '\n')

  const passCount = results.filter((r) => r.status === 'pass').length
  const warnCount = results.filter((r) => r.status === 'warn').length
  const failCount = results.filter((r) => r.status === 'fail').length

  process.stdout.write(`  通过 ${passCount} 项，警告 ${warnCount} 项，失败 ${failCount} 项\n\n`)

  if (failCount > 0) {
    process.exitCode = 1
  }
}

// 创建 doctor 命令帮助
export function createDoctorCommandHelp(): string {
  return `
vitamin doctor — 检查环境健康状态

检查项:
  - Node.js 版本（要求 >=22.0.0）
  - API Key / Token（Anthropic、OpenAI、Google、GitHub Copilot）
  - 项目配置文件
  - AGENTS.md 是否存在
  - Git 仓库状态

用法:
  vitamin doctor
`.trim()
}
