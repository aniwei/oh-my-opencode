// 会话列表页面 — 显示/管理所有会话
import {
  createSessionListComponent,
} from '@vitamin/tui'
import type { SessionEntry, ParsedKey } from '@vitamin/tui'

import type { AgentSession } from '../../../types'

// 会话列表页面
export class SessionListPage {
  private readonly session: AgentSession
  private readonly renderer: { renderFrame(lines: string[]): string }
  private width: number
  private selectedIndex = 0
  private sessions: SessionEntry[] = []

  constructor(
    session: AgentSession,
    renderer: { renderFrame(lines: string[]): string },
    width: number,
  ) {
    this.session = session
    this.renderer = renderer
    this.width = width
    this.refreshSessions()
  }

  // 刷新会话列表
  private refreshSessions(): void {
    // 从 sessionManager 获取会话列表
    const manager = this.session.subsystems.sessionManager
    this.sessions = [{
      id: this.session.id,
      title: 'Current Session',
      model: this.session.state.currentModel,
      messageCount: this.session.state.messageCount,
      updatedAt: new Date(),
      isActive: true,
    }]
  }

  // 处理按键
  handleInput(key: ParsedKey): void {
    if (key.name === 'up') {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1)
      return
    }

    if (key.name === 'down') {
      this.selectedIndex = Math.min(this.sessions.length - 1, this.selectedIndex + 1)
      return
    }

    if (key.name === 'return') {
      // 切换到选中的会话
      const selected = this.sessions[this.selectedIndex]
      if (selected) {
        // 实际切换逻辑取决于 session manager
      }
      return
    }

    if (key.name === 'delete' || (key.ctrl && key.name === 'd')) {
      // 删除选中会话
      const selected = this.sessions[this.selectedIndex]
      if (selected && !selected.isActive) {
        this.sessions = this.sessions.filter((_, i) => i !== this.selectedIndex)
        this.selectedIndex = Math.min(this.selectedIndex, this.sessions.length - 1)
      }
    }
  }

  // 渲染页面
  render(): string[] {
    const lines: string[] = []

    // 标题
    lines.push('\x1b[7m Sessions \x1b[0m')
    lines.push('─'.repeat(this.width))

    // 会话列表
    const listComponent = createSessionListComponent({
      sessions: this.sessions,
      selectedIndex: this.selectedIndex,
      showTimestamps: true,
    })
    lines.push(...listComponent.render(this.width))

    // 底部帮助
    lines.push('')
    lines.push('─'.repeat(this.width))
    lines.push('\x1b[2m  ↑/↓ Navigate  Enter Select  Del Delete  Tab Back\x1b[0m')

    return lines
  }

  resize(width: number): void {
    this.width = width
  }
}
