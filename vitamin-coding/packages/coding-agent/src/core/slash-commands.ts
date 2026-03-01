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
  description: 'Switch the current model',
  usage: '/model <model-id>',
  handler: async (args, session) => {
    if (args.length === 0) {
      return `Current model: ${session.state.currentModel}`
    }
    session.switchModel(args)
    return `Switched to model: ${args}`
  },
}

const clearCommand: SlashCommandDef = {
  name: 'clear',
  description: 'Clear the current conversation',
  handler: async (_args, _session) => {
    return 'Conversation cleared.'
  },
}

const compactCommand: SlashCommandDef = {
  name: 'compact',
  description: 'Compact the current session to reduce context size',
  handler: async (_args, session) => {
    await session.compact()
    return 'Session compacted.'
  },
}

const sessionCommand: SlashCommandDef = {
  name: 'session',
  description: 'Manage sessions (list, switch, delete)',
  usage: '/session <list|switch|delete> [id]',
  handler: async (args, session) => {
    const [subcommand, id] = args.split(/\s+/)

    switch (subcommand) {
      case 'list': {
        const sessions = await session.subsystems.sessionManager.list()
        if (sessions.length === 0) return 'No sessions found.'
        return sessions.map(s => `- ${s.id}: ${s.title} (${String(s.messageCount)} messages)`).join('\n')
      }
      case 'switch': {
        if (!id) return 'Usage: /session switch <id>'
        return `Switched to session: ${id}`
      }
      case 'delete': {
        if (!id) return 'Usage: /session delete <id>'
        await session.subsystems.sessionManager.remove(id)
        return `Session ${id} deleted.`
      }
      default:
        return 'Usage: /session <list|switch|delete> [id]'
    }
  },
}

const exportCommand: SlashCommandDef = {
  name: 'export',
  description: 'Export the current session',
  usage: '/export [html|md]',
  handler: async (args, _session) => {
    const format = args || 'html'
    return `Session exported as ${format}. (implementation pending)`
  },
}

const helpCommand: SlashCommandDef = {
  name: 'help',
  description: 'Show available commands',
  handler: async (_args, _session) => {
    return BUILTIN_COMMANDS.map(c => `/${c.name} — ${c.description}`).join('\n')
  },
}

const costCommand: SlashCommandDef = {
  name: 'cost',
  description: 'Show accumulated cost information',
  handler: async (_args, session) => {
    const { totalCost, totalTokens } = session.state
    return [
      `Total cost: $${totalCost.toFixed(4)}`,
      `Input tokens: ${String(totalTokens.input)}`,
      `Output tokens: ${String(totalTokens.output)}`,
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
    if (!command) return `Unknown command: /${parsed.name}. Type /help for available commands.`

    return command.handler(parsed.args, session)
  }
}

// 工厂函数
export function createSlashCommandRegistry(): SlashCommandRegistry {
  return new SlashCommandRegistry()
}
