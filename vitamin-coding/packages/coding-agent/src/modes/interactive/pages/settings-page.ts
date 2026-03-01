// 设置页面 — 运行时配置调整
import {
  createSelectListComponent,
  createTextComponent,
} from '@vitamin/tui'
import type { ParsedKey } from '@vitamin/tui'

import type { AgentSession } from '../../../types'

// 设置项
interface SettingItem {
  key: string
  label: string
  value: string
  editable: boolean
}

// 设置页面
export class SettingsPage {
  private readonly session: AgentSession
  private readonly renderer: { renderFrame(lines: string[]): string }
  private width: number
  private selectedIndex = 0
  private isEditing = false
  private editBuffer = ''
  private settings: SettingItem[]

  constructor(
    session: AgentSession,
    renderer: { renderFrame(lines: string[]): string },
    width: number,
  ) {
    this.session = session
    this.renderer = renderer
    this.width = width

    this.settings = this.buildSettings()
  }

  // 构建设置项列表
  private buildSettings(): SettingItem[] {
    return [
      {
        key: 'model',
        label: 'Current Model',
        value: this.session.state.currentModel,
        editable: true,
      },
      {
        key: 'totalCost',
        label: 'Total Cost',
        value: `$${this.session.state.totalCost.toFixed(4)}`,
        editable: false,
      },
      {
        key: 'totalTokens',
        label: 'Total Tokens',
        value: `${this.session.state.totalTokens.input + this.session.state.totalTokens.output}`,
        editable: false,
      },
      {
        key: 'messageCount',
        label: 'Message Count',
        value: String(this.session.state.messageCount),
        editable: false,
      },
      {
        key: 'sessionId',
        label: 'Session ID',
        value: this.session.id,
        editable: false,
      },
    ]
  }

  // 处理按键
  handleInput(key: ParsedKey): void {
    if (this.isEditing) {
      this.handleEditInput(key)
      return
    }

    if (key.name === 'up') {
      this.selectedIndex = Math.max(0, this.selectedIndex - 1)
      return
    }

    if (key.name === 'down') {
      this.selectedIndex = Math.min(this.settings.length - 1, this.selectedIndex + 1)
      return
    }

    if (key.name === 'return') {
      const setting = this.settings[this.selectedIndex]
      if (setting?.editable) {
        this.isEditing = true
        this.editBuffer = setting.value
      }
    }
  }

  // 处理编辑模式输入
  private handleEditInput(key: ParsedKey): void {
    if (key.name === 'return') {
      this.applyEdit()
      return
    }

    if (key.name === 'escape') {
      this.isEditing = false
      this.editBuffer = ''
      return
    }

    if (key.name === 'backspace') {
      this.editBuffer = this.editBuffer.slice(0, -1)
      return
    }

    if (key.sequence && key.sequence.length === 1 && !key.ctrl && !key.meta) {
      this.editBuffer += key.sequence
    }
  }

  // 应用编辑结果
  private applyEdit(): void {
    const setting = this.settings[this.selectedIndex]
    if (!setting) return

    if (setting.key === 'model') {
      this.session.switchModel(this.editBuffer.trim())
      setting.value = this.editBuffer.trim()
    }

    this.isEditing = false
    this.editBuffer = ''
    this.settings = this.buildSettings()
  }

  // 渲染页面
  render(): string[] {
    const lines: string[] = []

    lines.push('\x1b[7m Settings \x1b[0m')
    lines.push('─'.repeat(this.width))
    lines.push('')

    for (let i = 0; i < this.settings.length; i++) {
      const setting = this.settings[i]
      if (!setting) continue

      const isSelected = i === this.selectedIndex
      const prefix = isSelected ? '\x1b[36m▶\x1b[0m ' : '  '
      const editIndicator = setting.editable ? ' \x1b[2m(editable)\x1b[0m' : ''

      if (this.isEditing && isSelected) {
        lines.push(`${prefix}${setting.label}: \x1b[4m${this.editBuffer}\x1b[0m\u2588`)
      } else {
        lines.push(`${prefix}${setting.label}: ${setting.value}${editIndicator}`)
      }
    }

    lines.push('')
    lines.push('─'.repeat(this.width))
    lines.push('\x1b[2m  ↑/↓ Navigate  Enter Edit  Esc Cancel  Tab Back\x1b[0m')

    return lines
  }

  resize(width: number): void {
    this.width = width
  }
}
