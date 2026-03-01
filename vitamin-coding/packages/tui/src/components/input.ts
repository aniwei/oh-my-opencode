// 单行输入组件（光标 + 历史）
import { measureWidth } from '../utils/measure'

import type { Component } from '../renderer'

// 输入组件配置
export interface InputConfig {
  prompt?: string
  placeholder?: string
}

// 单行输入组件
export class InputComponent implements Component {
  private value = ''
  private cursorPos = 0
  private readonly history: string[] = []
  private historyIndex = -1
  private readonly prompt: string
  private readonly placeholder: string

  constructor(config: InputConfig = {}) {
    this.prompt = config.prompt ?? '> '
    this.placeholder = config.placeholder ?? ''
  }

  render(_width: number): string[] {
    const display = this.value || this.placeholder
    return [`${this.prompt}${display}`]
  }

  // 插入字符
  insert(char: string): void {
    this.value =
      this.value.slice(0, this.cursorPos) + char + this.value.slice(this.cursorPos)
    this.cursorPos += char.length
  }

  // 删除光标前的字符
  backspace(): void {
    if (this.cursorPos > 0) {
      this.value =
        this.value.slice(0, this.cursorPos - 1) + this.value.slice(this.cursorPos)
      this.cursorPos--
    }
  }

  // 删除光标后的字符
  delete(): void {
    if (this.cursorPos < this.value.length) {
      this.value =
        this.value.slice(0, this.cursorPos) + this.value.slice(this.cursorPos + 1)
    }
  }

  // 光标移动
  moveLeft(): void {
    if (this.cursorPos > 0) this.cursorPos--
  }

  moveRight(): void {
    if (this.cursorPos < this.value.length) this.cursorPos++
  }

  moveHome(): void {
    this.cursorPos = 0
  }

  moveEnd(): void {
    this.cursorPos = this.value.length
  }

  // 历史导航
  historyUp(): void {
    if (this.history.length === 0) return
    if (this.historyIndex < this.history.length - 1) {
      this.historyIndex++
      const entry = this.history[this.history.length - 1 - this.historyIndex]
      if (entry !== undefined) {
        this.value = entry
        this.cursorPos = this.value.length
      }
    }
  }

  historyDown(): void {
    if (this.historyIndex > 0) {
      this.historyIndex--
      const entry = this.history[this.history.length - 1 - this.historyIndex]
      if (entry !== undefined) {
        this.value = entry
        this.cursorPos = this.value.length
      }
    } else {
      this.historyIndex = -1
      this.value = ''
      this.cursorPos = 0
    }
  }

  // 提交当前值
  submit(): string {
    const val = this.value
    if (val.trim().length > 0) {
      this.history.push(val)
    }
    this.value = ''
    this.cursorPos = 0
    this.historyIndex = -1
    return val
  }

  // 获取/设置值
  getValue(): string {
    return this.value
  }

  setValue(value: string): void {
    this.value = value
    this.cursorPos = value.length
  }

  getCursorPos(): number {
    return this.cursorPos
  }

  getCursorDisplayPos(): number {
    return measureWidth(this.prompt) + measureWidth(this.value.slice(0, this.cursorPos))
  }
}

// 工厂函数
export function createInputComponent(config?: InputConfig): InputComponent {
  return new InputComponent(config)
}
