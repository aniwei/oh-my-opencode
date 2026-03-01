// Session 列表渲染组件 — 显示可用会话列表 (§S11.3)
import { truncateToWidth, padToWidth } from '../utils/measure'
import { style, COLORS } from '../utils/ansi'

import type { Component } from '../renderer'

export interface SessionEntry {
  id: string
  title: string
  model: string
  messageCount: number
  updatedAt: Date
  isActive: boolean
}

export interface SessionListConfig {
  sessions: SessionEntry[]
  selectedIndex: number
  showTimestamps?: boolean
}

export class SessionListComponent implements Component {
  private config: SessionListConfig

  constructor(config: SessionListConfig) {
    this.config = config
  }

  render(width: number): string[] {
    const lines: string[] = []
    const { sessions, selectedIndex, showTimestamps = true } = this.config

    // 标题
    lines.push(style(' Sessions ', COLORS.white))
    lines.push(padToWidth('─'.repeat(width), width))

    if (sessions.length === 0) {
      lines.push(`  ${style('No sessions', COLORS.gray)}`)
      return lines
    }

    for (let i = 0; i < sessions.length; i++) {
      const session = sessions[i]
      if (!session) continue

      const isSelected = i === selectedIndex
      const prefix = isSelected ? style('▶ ', COLORS.cyan) : '  '
      const activeIndicator = session.isActive ? style(' ●', COLORS.green) : ''

      // Session 标题 + 消息计数
      const title = truncateToWidth(session.title || session.id.slice(0, 8), width - 20)
      const msgCount = style(`(${session.messageCount})`, COLORS.gray)

      let line = `${prefix}${title} ${msgCount}${activeIndicator}`

      // 时间戳
      if (showTimestamps) {
        const timeAgo = formatTimeAgo(session.updatedAt)
        line += ` ${style(timeAgo, COLORS.gray)}`
      }

      lines.push(truncateToWidth(line, width))
    }

    return lines
  }

  setSelectedIndex(index: number): void {
    this.config.selectedIndex = index
  }

  setSessions(sessions: SessionEntry[]): void {
    this.config.sessions = sessions
  }
}

function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000)

  if (seconds < 60) return 'just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

export function createSessionListComponent(config: SessionListConfig): SessionListComponent {
  return new SessionListComponent(config)
}
