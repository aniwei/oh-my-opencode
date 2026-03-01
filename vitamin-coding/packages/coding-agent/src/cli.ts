// CLI 定义（Commander.js）
import { resolve } from 'node:path'

import type { CLIOptions, RunMode } from './types'

// 子命令集合
export type SubCommand = 'run' | 'doctor' | 'install' | 'config' | null

// CLI 解析结果（含子命令）
export interface ParsedCLI {
  options: CLIOptions
  subCommand: SubCommand
  subCommandArgs: string
}

// 解析 CLI 参数（不 import Commander，保持轻量，手动解析）
export function parseCLI(argv: string[]): CLIOptions {
  return parseCLIFull(argv).options
}

// 完整解析（含子命令识别）
export function parseCLIFull(argv: string[]): ParsedCLI {
  const args = argv.slice(2) // 跳过 node 和脚本路径
  let prompt: string | undefined
  let model: string | undefined
  let mode: RunMode = 'interactive'
  let configPath: string | undefined
  let projectDir = process.cwd()
  let verbose = false
  let maxTokens: number | undefined
  let continueSession: string | undefined
  let subCommand: SubCommand = null
  let subCommandArgs = ''

  // 检查第一个非 flag 参数是否为子命令
  const firstArg = args[0]
  if (firstArg === 'run' || firstArg === 'doctor' || firstArg === 'install' || firstArg === 'config') {
    subCommand = firstArg
    subCommandArgs = args.slice(1).join(' ')

    // doctor/install/config 不需要prompt
    if (subCommand === 'run') {
      prompt = args.slice(1).filter(a => !a.startsWith('-')).join(' ')
      mode = 'print'
    }
  }

  let i = subCommand ? 1 : 0
  while (i < args.length) {
    const arg = args[i]

    switch (arg) {
      case '--print':
      case '-p':
        mode = 'print'
        break
      case '--json':
        mode = 'json'
        break
      case '--rpc':
        mode = 'rpc'
        break
      case '--model':
      case '-m':
        i++
        model = args[i]
        break
      case '--config':
      case '-c':
        i++
        configPath = args[i]
        break
      case '--project':
      case '-d':
        i++
        projectDir = resolve(args[i] ?? process.cwd())
        break
      case '--verbose':
      case '-v':
        verbose = true
        break
      case '--max-tokens':
        i++
        maxTokens = Number(args[i])
        break
      case '--continue':
        i++
        continueSession = args[i]
        break
      case '--help':
      case '-h':
        printHelp()
        process.exit(0)
        break
      case '--version':
        printVersion()
        process.exit(0)
        break
      default:
        // 非 flag 参数视为 prompt（跳过子命令模式下已处理的 args）
        if (arg && !arg.startsWith('-') && !subCommand) {
          // 带 prompt 自动切换为 print 模式（除非显式指定了其他模式）
          if (prompt === undefined && mode === 'interactive') {
            mode = 'print'
          }
          prompt = prompt !== undefined ? prompt + ' ' + arg : arg
        }
        break
    }
    i++
  }

  return {
    options: {
      prompt,
      model,
      mode,
      configPath,
      projectDir,
      verbose,
      maxTokens,
      continueSession,
    },
    subCommand,
    subCommandArgs,
  }
}

function printHelp(): void {
  process.stdout.write(`
vitamin - AI coding assistant

Usage:
  vitamin [prompt]           Start with a prompt (print mode)
  vitamin                    Interactive TUI mode
  vitamin --json "query"     JSON output mode

Options:
  -p, --print             Print mode (non-interactive)
  --json                  JSON output mode
  --rpc                   RPC server mode (for SDK)
  -m, --model <id>        Override model
  -c, --config <path>     Config file path
  -d, --project <dir>     Project directory
  -v, --verbose           Verbose logging
  --max-tokens <n>        Max output tokens
  --continue <id>         Continue existing session
  -h, --help              Show help
  --version               Show version

Commands:
  vitamin run <prompt>    Run a one-shot prompt
  vitamin doctor          Check environment health
  vitamin install         Interactive setup
  vitamin config          Manage configuration
`)
}

function printVersion(): void {
  process.stdout.write('vitamin 0.0.1\n')
}
