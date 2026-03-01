// 消息展示渲染组件 — 渲染对话消息 (§S11.3)
import { wrapText, truncateToWidth } from '../utils/measure'
import { style, COLORS } from '../utils/ansi'

import type { Component } from '../renderer'

export type MessageRole = 'user' | 'assistant' | 'system' | 'tool'

export interface MessageEntry {
  role: MessageRole
  content: string
  agentName?: string
  timestamp?: Date
  toolCalls?: Array<{ name: string; status: 'pending' | 'done' | 'error' }>
}

export interface MessageDisplayConfig {
  messages: MessageEntry[]
  maxContentLines?: number
}

const ROLE_COLORS: Record<MessageRole, string> = {
  user: COLORS.green,
  assistant: COLORS.blue,
  system: COLORS.gray,
  tool: COLORS.cyan,
}

const ROLE_LABELS: Record<MessageRole, string> = {
  user: 'You',
  assistant: 'Assistant',
  system: 'System',
  tool: 'Tool',
}

export class MessageDisplayComponent implements Component {
  private config: MessageDisplayConfig

  constructor(config: MessageDisplayConfig) {
    this.config = config
  }

  render(width: number): string[] {
    const lines: string[] = []
    const maxContentLines = this.config.maxContentLines ?? 50

    for (const message of this.config.messages) {
      // 角色头部
      const roleColor = ROLE_COLORS[message.role]
      const roleLabel = ROLE_LABELS[message.role]

      const headerParts = [style(roleLabel, roleColor)]
      if (message.agentName && message.role === 'assistant') {
        headerParts.push(style(`(${message.agentName})`, COLORS.yellow))
      }
      if (message.timestamp) {
        headerParts.push(style(formatTime(message.timestamp), COLORS.gray))
      }

      lines.push(headerParts.join(' '))

      // 消息内容
      const contentLines = wrapText(message.content, width - 2)
      const displayLines = contentLines.slice(0, maxContentLines)
      for (const contentLine of displayLines) {
        lines.push(`  ${contentLine}`)
      }
      if (contentLines.length > maxContentLines) {
        lines.push(`  ${style(`... (${contentLines.length - maxContentLines} more lines)`, COLORS.gray)}`)
      }

      // 工具调用状态
      if (message.toolCalls && message.toolCalls.length > 0) {
        for (const tc of message.toolCalls) {
          const statusIcon = tc.status === 'done'
            ? style('✓', COLORS.green)
            : tc.status === 'error'
              ? style('✗', COLORS.red)
              : style('…', COLORS.yellow)
          lines.push(`  ${statusIcon} ${truncateToWidth(tc.name, width - 6)}`)
        }
      }

      // 消息间空行
      lines.push('')
    }

    return lines
  }

  setMessages(messages: MessageEntry[]): void {
    this.config.messages = messages
  }

  appendMessage(message: MessageEntry): void {
    this.config.messages.push(message)
  }
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit' })
}

export function createMessageDisplayComponent(config: MessageDisplayConfig): MessageDisplayComponent {
  return new MessageDisplayComponent(config)
}
