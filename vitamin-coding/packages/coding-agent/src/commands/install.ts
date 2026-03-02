import { access, mkdir, writeFile } from 'node:fs/promises'
// `vitamin install` — 交互式设置向导
import { join } from 'node:path'

import { createLogger } from '@vitamin/shared'

import { executeAuthCommand } from './auth'

const logger = createLogger('coding-agent:cmd:install')

// 安装步骤
export interface InstallStep {
  name: string
  description: string
  execute: (projectDir: string, readline: ReadlineInterface) => Promise<boolean>
}

// 标准输入读取接口（可测试替换）
export interface ReadlineInterface {
  question: (prompt: string) => Promise<string>
  close: () => void
}

// 创建基于 stdin 的 readline
export async function createStdinReadline(): Promise<ReadlineInterface> {
  const { createInterface } = await import('node:readline')
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  })
  return {
    question: (prompt: string) =>
      new Promise<string>((resolve) => {
        rl.question(prompt, (answer: string) => resolve(answer))
      }),
    close: () => rl.close(),
  }
}

// 所有安装步骤
const INSTALL_STEPS: InstallStep[] = [
  {
    name: '项目目录',
    description: '初始化 .vitamin 目录',
    execute: async (projectDir) => {
      const vitaminDir = join(projectDir, '.vitamin')
      try {
        await access(vitaminDir)
        process.stdout.write('  .vitamin/ 目录已存在\n')
      } catch {
        await mkdir(vitaminDir, { recursive: true })
        await mkdir(join(vitaminDir, 'sessions'), { recursive: true })
        await mkdir(join(vitaminDir, 'plans'), { recursive: true })
        process.stdout.write('  已创建 .vitamin/ 目录结构\n')
      }
      return true
    },
  },
  {
    name: 'API Key',
    description: '配置主要 AI 提供方',
    execute: async (_projectDir, readline) => {
      process.stdout.write('\n  请选择你要使用的 AI 提供方：\n')
      process.stdout.write('    1. Anthropic (Claude) — 推荐\n')
      process.stdout.write('    2. OpenAI (GPT)\n')
      process.stdout.write('    3. Google (Gemini)\n')
      process.stdout.write('    4. GitHub Copilot\n')
      process.stdout.write('    5. 跳过（稍后配置）\n\n')

      const choice = await readline.question('  选择提供方 [1-5]: ')

      const providerMap: Record<string, { name: string; envVar: string }> = {
        '1': { name: 'Anthropic', envVar: 'ANTHROPIC_API_KEY' },
        '2': { name: 'OpenAI', envVar: 'OPENAI_API_KEY' },
        '3': { name: 'Google', envVar: 'GOOGLE_API_KEY' },
        '4': { name: 'GitHub Copilot', envVar: 'GITHUB_TOKEN' },
      }

      const provider = providerMap[choice.trim()]
      if (!provider) {
        process.stdout.write('  已跳过 API Key 配置。\n')
        return true
      }

      const existingKey = process.env[provider.envVar]
      if (existingKey) {
        process.stdout.write(`  ${provider.envVar} 已设置。\n`)
        return true
      }

      if (provider.envVar === 'GITHUB_TOKEN') {
        process.stdout.write('  GitHub Copilot 将使用 OAuth Device Flow 授权。\n')
        await executeAuthCommand(_projectDir, 'copilot')
        return true
      }

      const key = await readline.question(`  请输入 ${provider.name} API Key: `)
      if (key.trim()) {
        process.stdout.write(`\n  若要持久化该 Key，请添加到你的 shell 配置文件：\n`)
        process.stdout.write(`    export ${provider.envVar}="${key.trim()}"\n\n`)
        if (provider.envVar === 'GITHUB_TOKEN') {
          process.stdout.write('  提示：Copilot 模型可使用如 github-copilot/claude-sonnet-4\n\n')
        }
      }

      return true
    },
  },
  {
    name: '配置文件',
    description: '创建默认配置',
    execute: async (projectDir, readline) => {
      const configPath = join(projectDir, '.vitamin', 'config.json')
      try {
        await access(configPath)
        process.stdout.write('  配置文件已存在\n')
        return true
      } catch {
        // File doesn't exist, create it
      }

      const answer = await readline.question('  是否创建默认配置文件？[Y/n]: ')
      if (answer.trim().toLowerCase() === 'n') {
        return true
      }

      const defaultConfig = {
        $schema: 'https://vitamin.dev/schema.json',
        model: 'github-copilot/claude-sonnet-4',
        defaultModel: 'github-copilot/claude-sonnet-4',
        agents: {},
        categories: {},
        mcps: {},
      }

      await writeFile(configPath, JSON.stringify(defaultConfig, null, 2) + '\n')
      process.stdout.write('  已创建 .vitamin/config.json\n')
      return true
    },
  },
  {
    name: 'AGENTS.md',
    description: '创建项目上下文文件',
    execute: async (projectDir, readline) => {
      const agentsPath = join(projectDir, 'AGENTS.md')
      try {
        await access(agentsPath)
        process.stdout.write('  AGENTS.md 已存在\n')
        return true
      } catch {
        // File doesn't exist
      }

      const answer = await readline.question('  是否创建 AGENTS.md 模板？[Y/n]: ')
      if (answer.trim().toLowerCase() === 'n') {
        return true
      }

      const template = `# Project Context

## Overview
<!-- Describe your project here -->

## Structure
<!-- Key files and directories -->

## Conventions
<!-- Coding conventions and preferences -->

## Notes
<!-- Additional context for the AI assistant -->
`

      await writeFile(agentsPath, template)
      process.stdout.write('  已创建 AGENTS.md 模板\n')
      return true
    },
  },
]

// 执行安装向导
export async function executeInstallCommand(projectDir: string): Promise<void> {
  logger.info('Running install wizard for project: %s', projectDir)

  process.stdout.write('\nvitamin install — 交互式初始化\n')
  process.stdout.write('─'.repeat(50) + '\n\n')

  const readline = await createStdinReadline()

  try {
    for (const step of INSTALL_STEPS) {
      process.stdout.write(`\u25B6 ${step.name}: ${step.description}\n`)
      const success = await step.execute(projectDir, readline)
      if (!success) {
        process.stdout.write(`  警告：${step.name} 初始化未完成\n`)
      }
      process.stdout.write('\n')
    }

    process.stdout.write('─'.repeat(50) + '\n')
    process.stdout.write('  初始化完成！运行 `vitamin` 开始使用。\n\n')
  } finally {
    readline.close()
  }
}

// 创建 install 命令帮助
export function createInstallCommandHelp(): string {
  return `
vitamin install — 交互式初始化向导

步骤:
  1. 初始化 .vitamin/ 目录
  2. 配置 API 提供方与密钥（含 GitHub Copilot）
  3. 创建默认配置
  4. 创建 AGENTS.md 模板

用法:
  vitamin install
  vitamin install --project /path/to/project
`.trim()
}
