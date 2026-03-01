// 消息气泡组件 — 渲染单条消息为气泡样式
import { wrapText } from '@vitamin/tui'
import type { Component } from '@vitamin/tui'

export interface MessageBubbleConfig {
  role: 'user' | 'assistant' | 'system'
  content: string
  agentName?: string
  timestamp?: Date
  maxWidth?: number
}

// 角色样式
const ROLE_STYLES: Record<string, { prefix: string; color: string }> = {
  user: { prefix: '\x1b[32mYou\x1b[0m', color: '\x1b[32m' },
  assistant: { prefix: '\x1b[34mAssistant\x1b[0m', color: '\x1b[34m' },
  system: { prefix: '\x1b[90mSystem\x1b[0m', color: '\x1b[90m' },
}

export class MessageBubble implements Component {
  private config: MessageBubbleConfig

  constructor(config: MessageBubbleConfig) {
    this.config = config
  }

  render(width: number): string[] {
    const maxWidth = this.config.maxWidth ?? width - 4
    const style = ROLE_STYLES[this.config.role] ?? ROLE_STYLES['assistant']
    const lines: string[] = []

    // 头部：角色名 + agent 名 + 时间
    const agentSuffix = this.config.agentName ? ` (${this.config.agentName})` : ''
    const timeSuffix = this.config.timestamp
      ? `  \x1b[2m${this.config.timestamp.toLocaleTimeString()}\x1b[0m`
      : ''
    lines.push(`${style?.prefix}${agentSuffix}${timeSuffix}`)

    // 内容折行
    const wrappedLines = wrapText(this.config.content, maxWidth)
    for (const line of wrappedLines) {
      lines.push(`  ${line}`)
    }

    // 空行分隔
    lines.push('')

    return lines
  }
}

export function createMessageBubble(config: MessageBubbleConfig): MessageBubble {
  return new MessageBubble(config)
}
