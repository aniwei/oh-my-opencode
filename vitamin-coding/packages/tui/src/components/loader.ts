// 加载动画组件（spinner）
import type { Component } from '../renderer'

// Spinner 框架
const DEFAULT_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

// 加载器配置
export interface LoaderConfig {
  text?: string
  frames?: string[]
  interval?: number
}

// 加载动画组件
export class LoaderComponent implements Component {
  private frameIndex = 0
  private readonly frames: string[]
  private text: string
  private running = false
  private timer: ReturnType<typeof setInterval> | null = null
  private readonly interval: number
  private onUpdate: (() => void) | null = null

  constructor(config: LoaderConfig = {}) {
    this.frames = config.frames ?? DEFAULT_FRAMES
    this.text = config.text ?? 'Loading...'
    this.interval = config.interval ?? 80
  }

  render(_width: number): string[] {
    const frame = this.frames[this.frameIndex % this.frames.length] ?? '⠋'
    return [`${frame} ${this.text}`]
  }

  // 开始动画
  start(onUpdate?: () => void): void {
    if (this.running) return
    this.running = true
    this.onUpdate = onUpdate ?? null
    this.timer = setInterval(() => {
      this.frameIndex = (this.frameIndex + 1) % this.frames.length
      this.onUpdate?.()
    }, this.interval)
  }

  // 停止动画
  stop(): void {
    if (!this.running) return
    this.running = false
    if (this.timer !== null) {
      clearInterval(this.timer)
      this.timer = null
    }
  }

  // 更新文本
  setText(text: string): void {
    this.text = text
  }

  // 获取文本
  getText(): string {
    return this.text
  }

  // 是否正在运行
  isRunning(): boolean {
    return this.running
  }

  // 获取当前帧索引
  getFrameIndex(): number {
    return this.frameIndex
  }

  // 手动推进帧（用于测试）
  advance(): void {
    this.frameIndex = (this.frameIndex + 1) % this.frames.length
  }
}

// 工厂函数
export function createLoaderComponent(config?: LoaderConfig): LoaderComponent {
  return new LoaderComponent(config)
}
