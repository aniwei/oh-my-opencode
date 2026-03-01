// `vitamin install` — 交互式设置向导
import { join } from 'node:path'
import { mkdir, writeFile, access } from 'node:fs/promises'

import { createLogger } from '@vitamin/shared'

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
export function createStdinReadline(): ReadlineInterface {
  const rl = require('node:readline').createInterface({
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
    name: 'Project Directory',
    description: 'Initialize .vitamin directory',
    execute: async (projectDir) => {
      const vitaminDir = join(projectDir, '.vitamin')
      try {
        await access(vitaminDir)
        process.stdout.write('  .vitamin/ directory already exists\n')
      } catch {
        await mkdir(vitaminDir, { recursive: true })
        await mkdir(join(vitaminDir, 'sessions'), { recursive: true })
        await mkdir(join(vitaminDir, 'plans'), { recursive: true })
        process.stdout.write('  Created .vitamin/ directory structure\n')
      }
      return true
    },
  },
  {
    name: 'API Key',
    description: 'Configure primary AI provider',
    execute: async (_projectDir, readline) => {
      process.stdout.write('\n  Which AI provider would you like to use?\n')
      process.stdout.write('    1. Anthropic (Claude) — recommended\n')
      process.stdout.write('    2. OpenAI (GPT)\n')
      process.stdout.write('    3. Google (Gemini)\n')
      process.stdout.write('    4. Skip (configure later)\n\n')

      const choice = await readline.question('  Select provider [1-4]: ')

      const providerMap: Record<string, { name: string; envVar: string }> = {
        '1': { name: 'Anthropic', envVar: 'ANTHROPIC_API_KEY' },
        '2': { name: 'OpenAI', envVar: 'OPENAI_API_KEY' },
        '3': { name: 'Google', envVar: 'GOOGLE_API_KEY' },
      }

      const provider = providerMap[choice.trim()]
      if (!provider) {
        process.stdout.write('  Skipping API key configuration.\n')
        return true
      }

      const existingKey = process.env[provider.envVar]
      if (existingKey) {
        process.stdout.write(`  ${provider.envVar} is already set.\n`)
        return true
      }

      const key = await readline.question(`  Enter your ${provider.name} API key: `)
      if (key.trim()) {
        process.stdout.write(`\n  To persist this key, add to your shell profile:\n`)
        process.stdout.write(`    export ${provider.envVar}="${key.trim()}"\n\n`)
      }

      return true
    },
  },
  {
    name: 'Config File',
    description: 'Create default configuration',
    execute: async (projectDir, readline) => {
      const configPath = join(projectDir, '.vitamin', 'config.json')
      try {
        await access(configPath)
        process.stdout.write('  Config file already exists\n')
        return true
      } catch {
        // File doesn't exist, create it
      }

      const answer = await readline.question('  Create default config file? [Y/n]: ')
      if (answer.trim().toLowerCase() === 'n') {
        return true
      }

      const defaultConfig = {
        $schema: 'https://vitamin.dev/schema.json',
        defaultModel: 'claude-sonnet',
        agents: {},
        categories: {},
        mcps: {},
      }

      await writeFile(configPath, JSON.stringify(defaultConfig, null, 2) + '\n')
      process.stdout.write('  Created .vitamin/config.json\n')
      return true
    },
  },
  {
    name: 'AGENTS.md',
    description: 'Create project context file',
    execute: async (projectDir, readline) => {
      const agentsPath = join(projectDir, 'AGENTS.md')
      try {
        await access(agentsPath)
        process.stdout.write('  AGENTS.md already exists\n')
        return true
      } catch {
        // File doesn't exist
      }

      const answer = await readline.question('  Create AGENTS.md template? [Y/n]: ')
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
      process.stdout.write('  Created AGENTS.md template\n')
      return true
    },
  },
]

// 执行安装向导
export async function executeInstallCommand(projectDir: string): Promise<void> {
  logger.info('Running install wizard for project: %s', projectDir)

  process.stdout.write('\nvitamin install — Interactive Setup\n')
  process.stdout.write('─'.repeat(50) + '\n\n')

  const readline = createStdinReadline()

  try {
    for (const step of INSTALL_STEPS) {
      process.stdout.write(`\u25B6 ${step.name}: ${step.description}\n`)
      const success = await step.execute(projectDir, readline)
      if (!success) {
        process.stdout.write(`  Warning: ${step.name} setup incomplete\n`)
      }
      process.stdout.write('\n')
    }

    process.stdout.write('─'.repeat(50) + '\n')
    process.stdout.write('  Setup complete! Run `vitamin` to start.\n\n')
  } finally {
    readline.close()
  }
}

// 创建 install 命令帮助
export function createInstallCommandHelp(): string {
  return `
vitamin install — Interactive setup wizard

Steps:
  1. Initialize .vitamin/ directory
  2. Configure API provider and key
  3. Create default configuration
  4. Create AGENTS.md template

Usage:
  vitamin install
  vitamin install --project /path/to/project
`.trim()
}
