// 差异渲染引擎（§S11.1: 每帧 string[] → diff → 最小化 CSI 输出）
import { TypedEventEmitter } from '@vitamin/shared'

import { clearLine, moveCursor, SYNC_END, SYNC_START } from './utils/ansi'

import type { EventMap } from '@vitamin/shared'

// 组件接口
export interface Component {
  render(width: number): string[]
}

// 渲染器事件
interface RendererEvents extends EventMap {
  render: () => void
  resize: (width: number, height: number) => void
}

// 差异渲染引擎
export class Renderer extends TypedEventEmitter<RendererEvents> {
  private previousFrame: string[] = []
  private width: number
  private height: number
  private readonly output: (data: string) => void

  constructor(config: {
    width: number
    height: number
    output: (data: string) => void
  }) {
    super()
    this.width = config.width
    this.height = config.height
    this.output = config.output
  }

  // 渲染一帧（组件输出 → diff → 最小化 CSI 输出）
  renderFrame(lines: string[]): string {
    const diffOutput = this.computeDiff(this.previousFrame, lines)
    this.previousFrame = [...lines]

    if (diffOutput.length === 0) {
      // 无变化，不输出
      return ''
    }

    // 包裹在同步输出中（CSI 2026）
    const result = SYNC_START + diffOutput + SYNC_END
    this.output(result)
    this.emit('render')
    return result
  }

  // 计算差异输出（仅输出变更行）
  private computeDiff(prev: string[], next: string[]): string {
    let result = ''
    const maxLen = Math.max(prev.length, next.length)

    for (let i = 0; i < maxLen; i++) {
      const prevLine = prev[i]
      const nextLine = next[i]

      if (prevLine !== nextLine) {
        // 行有变化，输出: 移动光标到该行 + 清行 + 写入新内容
        result += moveCursor(i + 1, 1) + clearLine() + (nextLine ?? '')
      }
    }

    return result
  }

  // 强制全量重绘
  fullRedraw(lines: string[]): string {
    this.previousFrame = [...lines]
    let result = SYNC_START
    for (let i = 0; i < lines.length; i++) {
      result += moveCursor(i + 1, 1) + clearLine() + (lines[i] ?? '')
    }
    result += SYNC_END
    this.output(result)
    this.emit('render')
    return result
  }

  // 更新终端尺寸
  resize(width: number, height: number): void {
    this.width = width
    this.height = height
    this.previousFrame = []
    this.emit('resize', width, height)
  }

  // 获取当前尺寸
  getWidth(): number {
    return this.width
  }

  getHeight(): number {
    return this.height
  }

  // 清除前一帧缓存
  clearCache(): void {
    this.previousFrame = []
  }
}

// 工厂函数
export function createRenderer(config: {
  width: number
  height: number
  output: (data: string) => void
}): Renderer {
  return new Renderer(config)
}
