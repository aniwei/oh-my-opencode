// 多行编辑器组件（Tab 补全 + 粘贴处理）
import type { Component } from '../renderer'

// 编辑器配置
export interface EditorConfig {
  tabSize?: number
  maxLines?: number
}

// 多行编辑器
export class EditorComponent implements Component {
  private lines: string[] = ['']
  private cursorRow = 0
  private cursorCol = 0
  private readonly tabSize: number
  private readonly maxLines: number

  constructor(config: EditorConfig = {}) {
    this.tabSize = config.tabSize ?? 2
    this.maxLines = config.maxLines ?? 1000
  }

  render(_width: number): string[] {
    return [...this.lines]
  }

  // 插入字符
  insert(char: string): void {
    const line = this.lines[this.cursorRow] ?? ''
    this.lines[this.cursorRow] =
      line.slice(0, this.cursorCol) + char + line.slice(this.cursorCol)
    this.cursorCol += char.length
  }

  // 插入多行粘贴（验收 4.1.5）
  paste(text: string): void {
    const pasteLines = text.split('\n')

    if (pasteLines.length === 1) {
      // 单行粘贴
      this.insert(pasteLines[0] ?? '')
      return
    }

    // 多行粘贴
    const currentLine = this.lines[this.cursorRow] ?? ''
    const before = currentLine.slice(0, this.cursorCol)
    const after = currentLine.slice(this.cursorCol)

    // 第一行: 当前行的前半 + 第一个粘贴行
    this.lines[this.cursorRow] = before + (pasteLines[0] ?? '')

    // 中间行
    const middleLines = pasteLines.slice(1, -1)
    const lastPasteLine = pasteLines[pasteLines.length - 1] ?? ''

    // 最后一行: 最后一个粘贴行 + 当前行的后半
    const newLines = [
      ...this.lines.slice(0, this.cursorRow + 1),
      ...middleLines,
      lastPasteLine + after,
      ...this.lines.slice(this.cursorRow + 1),
    ]

    this.lines = newLines.slice(0, this.maxLines)
    this.cursorRow = Math.min(
      this.cursorRow + pasteLines.length - 1,
      this.lines.length - 1,
    )
    this.cursorCol = lastPasteLine.length
  }

  // 退格
  backspace(): void {
    if (this.cursorCol > 0) {
      const line = this.lines[this.cursorRow] ?? ''
      this.lines[this.cursorRow] =
        line.slice(0, this.cursorCol - 1) + line.slice(this.cursorCol)
      this.cursorCol--
    } else if (this.cursorRow > 0) {
      // 合并到上一行
      const currentLine = this.lines[this.cursorRow] ?? ''
      const prevLine = this.lines[this.cursorRow - 1] ?? ''
      this.cursorCol = prevLine.length
      this.lines[this.cursorRow - 1] = prevLine + currentLine
      this.lines.splice(this.cursorRow, 1)
      this.cursorRow--
    }
  }

  // 回车换行
  enter(): void {
    if (this.lines.length >= this.maxLines) return
    const line = this.lines[this.cursorRow] ?? ''
    const before = line.slice(0, this.cursorCol)
    const after = line.slice(this.cursorCol)
    this.lines[this.cursorRow] = before
    this.lines.splice(this.cursorRow + 1, 0, after)
    this.cursorRow++
    this.cursorCol = 0
  }

  // Tab 缩进
  tab(): void {
    const spaces = ' '.repeat(this.tabSize)
    this.insert(spaces)
  }

  // 光标移动
  moveUp(): void {
    if (this.cursorRow > 0) {
      this.cursorRow--
      const line = this.lines[this.cursorRow] ?? ''
      this.cursorCol = Math.min(this.cursorCol, line.length)
    }
  }

  moveDown(): void {
    if (this.cursorRow < this.lines.length - 1) {
      this.cursorRow++
      const line = this.lines[this.cursorRow] ?? ''
      this.cursorCol = Math.min(this.cursorCol, line.length)
    }
  }

  moveLeft(): void {
    if (this.cursorCol > 0) {
      this.cursorCol--
    }
  }

  moveRight(): void {
    const line = this.lines[this.cursorRow] ?? ''
    if (this.cursorCol < line.length) {
      this.cursorCol++
    }
  }

  // 获取内容
  getContent(): string {
    return this.lines.join('\n')
  }

  // 设置内容
  setContent(text: string): void {
    this.lines = text.split('\n').slice(0, this.maxLines)
    this.cursorRow = 0
    this.cursorCol = 0
  }

  // 获取行数
  getLineCount(): number {
    return this.lines.length
  }

  getCursor(): { row: number; col: number } {
    return { row: this.cursorRow, col: this.cursorCol }
  }
}

// 工厂函数
export function createEditorComponent(config?: EditorConfig): EditorComponent {
  return new EditorComponent(config)
}
