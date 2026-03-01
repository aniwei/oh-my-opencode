// tmux-manager Extension — Tmux 会话管理（§S9, 5.2.5）
// 创建/管理/销毁 tmux session

import { z } from 'zod'

import type { AgentTool, ToolResult } from '@vitamin/agent'

import type { ExtensionFactory } from '../../types'

// Tmux 会话信息
export interface TmuxSession {
  id: string
  name: string
  windows: number
  attached: boolean
  created: string
}

// tmux-manager 外部依赖回调接口
export interface TmuxManagerCallbacks {
  execTmux: (args: string[]) => Promise<{ success: boolean; output?: string; error?: string }>
  isTmuxAvailable: () => Promise<boolean>
}

// 解析 tmux list-sessions 输出
export function parseTmuxSessions(output: string): TmuxSession[] {
  const sessions: TmuxSession[] = []
  const lines = output.trim().split('\n')

  for (const line of lines) {
    if (!line.trim()) continue
    const match = /^([^:]+):\s+(\d+)\s+windows?\s+\(created\s+(.+?)\)(\s+\(attached\))?/.exec(line)
    if (match) {
      const name = match[1]
      const windows = match[2]
      const created = match[3]
      const attached = match[4]
      if (name && windows && created) {
        sessions.push({
          id: name,
          name,
          windows: parseInt(windows, 10),
          attached: attached !== undefined,
          created,
        })
      }
    }
  }

  return sessions
}

// Zod schemas
const TmuxCreateSchema = z.object({
  name: z.string().describe('会话名称'),
  command: z.string().optional().describe('初始命令（可选）'),
  detached: z.boolean().optional().describe('是否后台创建（默认 true）'),
})

const TmuxListSchema = z.object({})

const TmuxKillSchema = z.object({
  name: z.string().optional().describe('要销毁的会话名称'),
  all: z.boolean().optional().describe('销毁所有会话'),
})

const TmuxSendSchema = z.object({
  session: z.string().describe('目标会话名称'),
  command: z.string().describe('要发送的命令'),
  enter: z.boolean().optional().describe('发送后是否按回车（默认 true）'),
})

const TmuxCaptureSchema = z.object({
  session: z.string().describe('目标会话名称'),
  lines: z.number().optional().describe('捕获行数（默认 100）'),
})

// 创建 tmux-manager Extension 工厂
export function createTmuxManagerExtension(callbacks: TmuxManagerCallbacks): ExtensionFactory {
  return async (api) => {
    api.log.info('tmux-manager Extension 初始化')

    const available = await callbacks.isTmuxAvailable()
    if (!available) {
      api.log.warn('tmux 不可用，tmux-manager Extension 功能受限')
    }

    const unavailableResult: ToolResult = {
      content: [{ type: 'text', text: 'tmux 未安装或不可用' }],
      isError: true,
    }

    // tmux-create 工具
    api.registerTool({
      name: 'tmux-create',
      description: '创建新的 tmux 会话。',
      parameters: TmuxCreateSchema,
      visibility: 'always',
      async execute(_id, rawArgs, _signal): Promise<ToolResult> {
        if (!available) return unavailableResult
        const args = TmuxCreateSchema.parse(rawArgs)
        const tmuxArgs = ['new-session', '-d', '-s', args.name]
        if (args.command) tmuxArgs.push(args.command)
        const result = await callbacks.execTmux(tmuxArgs)
        return {
          content: [{ type: 'text', text: result.success ? `tmux 会话 ${args.name} 已创建` : `创建失败: ${result.error ?? 'unknown'}` }],
          isError: !result.success,
        }
      },
    } as AgentTool)

    // tmux-list 工具
    api.registerTool({
      name: 'tmux-list',
      description: '列出所有 tmux 会话。',
      parameters: TmuxListSchema,
      visibility: 'always',
      async execute(_id, _rawArgs, _signal): Promise<ToolResult> {
        if (!available) return unavailableResult
        const result = await callbacks.execTmux(['list-sessions'])
        if (!result.success) {
          const noServer = result.error?.includes('no server') ?? false
          if (noServer) return { content: [{ type: 'text', text: '当前没有 tmux 会话' }] }
          return { content: [{ type: 'text', text: `列出失败: ${result.error ?? 'unknown'}` }], isError: true }
        }
        const sessions = parseTmuxSessions(result.output ?? '')
        if (sessions.length === 0) return { content: [{ type: 'text', text: '当前没有 tmux 会话' }] }
        const lines = sessions.map((s) => `  ${s.name}: ${String(s.windows)} windows${s.attached ? ' (attached)' : ''}`)
        return { content: [{ type: 'text', text: `tmux 会话:\n${lines.join('\n')}` }] }
      },
    } as AgentTool)

    // tmux-kill 工具
    api.registerTool({
      name: 'tmux-kill',
      description: '销毁指定的 tmux 会话。',
      parameters: TmuxKillSchema,
      visibility: 'always',
      async execute(_id, rawArgs, _signal): Promise<ToolResult> {
        if (!available) return unavailableResult
        const args = TmuxKillSchema.parse(rawArgs)
        if (args.all) {
          const result = await callbacks.execTmux(['kill-server'])
          return {
            content: [{ type: 'text', text: result.success ? '所有 tmux 会话已销毁' : `销毁失败: ${result.error ?? 'unknown'}` }],
            isError: !result.success,
          }
        }
        if (!args.name) return { content: [{ type: 'text', text: '请提供会话名称或使用 all: true 销毁全部' }], isError: true }
        const result = await callbacks.execTmux(['kill-session', '-t', args.name])
        return {
          content: [{ type: 'text', text: result.success ? `tmux 会话 ${args.name} 已销毁` : `销毁失败: ${result.error ?? 'unknown'}` }],
          isError: !result.success,
        }
      },
    } as AgentTool)

    // tmux-send 工具
    api.registerTool({
      name: 'tmux-send',
      description: '向 tmux 会话发送命令。',
      parameters: TmuxSendSchema,
      visibility: 'always',
      async execute(_id, rawArgs, _signal): Promise<ToolResult> {
        if (!available) return unavailableResult
        const args = TmuxSendSchema.parse(rawArgs)
        const sendArgs = ['send-keys', '-t', args.session, args.command]
        if (args.enter !== false) sendArgs.push('Enter')
        const result = await callbacks.execTmux(sendArgs)
        return {
          content: [{ type: 'text', text: result.success ? `命令已发送到 ${args.session}` : `发送失败: ${result.error ?? 'unknown'}` }],
          isError: !result.success,
        }
      },
    } as AgentTool)

    // tmux-capture 工具
    api.registerTool({
      name: 'tmux-capture',
      description: '捕获 tmux 会话的当前输出内容。',
      parameters: TmuxCaptureSchema,
      visibility: 'always',
      async execute(_id, rawArgs, _signal): Promise<ToolResult> {
        if (!available) return unavailableResult
        const args = TmuxCaptureSchema.parse(rawArgs)
        const lines = args.lines ?? 100
        const captureResult = await callbacks.execTmux([
          'capture-pane', '-t', args.session, '-p', '-S', String(-lines),
        ])
        if (!captureResult.success) {
          return { content: [{ type: 'text', text: `捕获失败: ${captureResult.error ?? 'unknown'}` }], isError: true }
        }
        return { content: [{ type: 'text', text: captureResult.output ?? '(empty)' }] }
      },
    } as AgentTool)

    api.log.info('tmux-manager Extension 已注册 5 个 tmux 工具')
  }
}

// 创建 tmux-manager Extension 描述符
export function createTmuxManagerDescriptor(
  callbacks: TmuxManagerCallbacks,
): { name: string; source: 'builtin'; entryPoint: string; factory: ExtensionFactory } {
  return {
    name: 'tmux-manager',
    source: 'builtin',
    entryPoint: __filename,
    factory: createTmuxManagerExtension(callbacks),
  }
}
