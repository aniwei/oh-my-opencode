// 斜杠命令系统
import type { AgentSession, SlashCommandDef } from '../types'

// 解析斜杠命令
export function parseSlashCommand(input: string): { name: string; args: string } | null {
  const trimmed = input.trim()
  if (!trimmed.startsWith('/')) return null

  const spaceIndex = trimmed.indexOf(' ')
  if (spaceIndex === -1) {
    return { name: trimmed.slice(1), args: '' }
  }

  return {
    name: trimmed.slice(1, spaceIndex),
    args: trimmed.slice(spaceIndex + 1).trim(),
  }
}

// 内置斜杠命令

const modelCommand: SlashCommandDef = {
  name: 'model',
  description: '切换当前模型',
  usage: '/model <model-id>',
  handler: async (args, session) => {
    if (args.length === 0) {
      return `当前模型：${session.state.currentModel}`
    }
    session.switchModel(args)
    return `已切换到模型：${args}`
  },
}

const clearCommand: SlashCommandDef = {
  name: 'clear',
  description: '清空当前对话',
  handler: async (_args, _session) => {
    return '对话已清空。'
  },
}

const compactCommand: SlashCommandDef = {
  name: 'compact',
  description: '压缩当前会话以减少上下文占用',
  handler: async (_args, session) => {
    await session.compact()
    return '会话已压缩。'
  },
}

const sessionCommand: SlashCommandDef = {
  name: 'session',
  description: '会话管理（list、switch、delete）',
  usage: '/session <list|switch|delete> [id]',
  handler: async (args, session) => {
    const [subcommand, id] = args.split(/\s+/)

    switch (subcommand) {
      case 'list': {
        const sessions = await session.listSessions()
        if (sessions.length === 0) return '未找到会话。'
        return sessions
          .map((s) => {
            const active = s.id === session.id ? ' [active]' : ''
            return `- ${s.id}: ${s.title}（${String(s.messageCount)} 条消息）${active}`
          })
          .join('\n')
      }
      case 'switch': {
        if (!id) return '用法：/session switch <id>'
        try {
          await session.switchSession(id)
          return `已切换到会话：${id}`
        } catch {
          return `会话不存在：${id}`
        }
      }
      case 'delete': {
        if (!id) return '用法：/session delete <id>'
        try {
          await session.deleteSession(id)
        } catch (error) {
          if (error instanceof Error && error.message === 'Cannot delete active session') {
            return `不能删除当前会话：${id}`
          }
          return `会话不存在：${id}`
        }
        return `会话 ${id} 已删除。`
      }
      default:
        return '用法：/session <list|switch|delete> [id]'
    }
  },
}

const exportCommand: SlashCommandDef = {
  name: 'export',
  description: '导出当前会话',
  usage: '/export [html|md]',
  handler: async (args, _session) => {
    const format = args || 'html'
    return `会话已导出为 ${format}。（功能待完善）`
  },
}

const initCommand: SlashCommandDef = {
  name: 'init',
  description: '初始化项目级代理配置',
  usage: '/init',
  handler: async (_args, _session) => {
    return '初始化向导已触发。（功能待完善）'
  },
}

const undoCommand: SlashCommandDef = {
  name: 'undo',
  description: '撤销上一条用户消息',
  usage: '/undo',
  handler: async (_args, _session) => {
    return '已撤销上一条消息。（功能待完善）'
  },
}

const redoCommand: SlashCommandDef = {
  name: 'redo',
  description: '重做最近一次撤销',
  usage: '/redo',
  handler: async (_args, _session) => {
    return '已重做上一条撤销操作。（功能待完善）'
  },
}

const shareCommand: SlashCommandDef = {
  name: 'share',
  description: '分享当前会话',
  usage: '/share',
  handler: async (_args, _session) => {
    return '分享已创建。（功能待完善）'
  },
}

const helpCommand: SlashCommandDef = {
  name: 'help',
  description: '显示可用命令',
  handler: async (_args, _session) => {
    return BUILTIN_COMMANDS.map((c) => `/${c.name} — ${c.description}`).join('\n')
  },
}

const costCommand: SlashCommandDef = {
  name: 'cost',
  description: '显示累计成本信息',
  handler: async (_args, session) => {
    const { totalCost, totalTokens } = session.state
    return [
      `总成本：$${totalCost.toFixed(4)}`,
      `输入 Token：${String(totalTokens.input)}`,
      `输出 Token：${String(totalTokens.output)}`,
    ].join('\n')
  },
}

// 所有内置命令
export const BUILTIN_COMMANDS: SlashCommandDef[] = [
  modelCommand,
  clearCommand,
  compactCommand,
  sessionCommand,
  exportCommand,
  initCommand,
  undoCommand,
  redoCommand,
  shareCommand,
  helpCommand,
  costCommand,
]

// 斜杠命令注册表
export class SlashCommandRegistry {
  private commands: Map<string, SlashCommandDef> = new Map()

  constructor() {
    for (const cmd of BUILTIN_COMMANDS) {
      this.commands.set(cmd.name, cmd)
    }
  }

  register(command: SlashCommandDef): void {
    this.commands.set(command.name, command)
  }

  get(name: string): SlashCommandDef | undefined {
    return this.commands.get(name)
  }

  listAll(): SlashCommandDef[] {
    return [...this.commands.values()]
  }

  async execute(input: string, session: AgentSession): Promise<string | null> {
    const parsed = parseSlashCommand(input)
    if (parsed === null) return null

    const command = this.commands.get(parsed.name)
    if (!command) return `未知命令：/${parsed.name}。输入 /help 查看可用命令。`

    return command.handler(parsed.args, session)
  }
}

// 工厂函数
export function createSlashCommandRegistry(): SlashCommandRegistry {
  return new SlashCommandRegistry()
}
