// Overlay 管理器（z-index + 焦点管理）
import { TypedEventEmitter } from '@vitamin/shared'

import type { Component } from '../renderer'
import type { EventMap } from '@vitamin/shared'

// Overlay 实例
export interface Overlay {
  id: string
  component: Component
  zIndex: number
  visible: boolean
  x: number
  y: number
  width: number
  height: number
}

// Overlay 事件
interface OverlayEvents extends EventMap {
  show: (id: string) => void
  hide: (id: string) => void
  focus: (id: string) => void
  change: () => void
}

// Overlay 管理器
export class OverlayManager extends TypedEventEmitter<OverlayEvents> {
  private overlays: Map<string, Overlay> = new Map()
  private focusedId: string | null = null

  // 注册 overlay
  register(overlay: Overlay): void {
    this.overlays.set(overlay.id, overlay)
    this.emit('change')
  }

  // 移除 overlay
  unregister(id: string): void {
    this.overlays.delete(id)
    if (this.focusedId === id) {
      this.focusedId = null
    }
    this.emit('change')
  }

  // 显示 overlay
  show(id: string): void {
    const overlay = this.overlays.get(id)
    if (overlay) {
      overlay.visible = true
      this.focusedId = id
      this.emit('show', id)
      this.emit('focus', id)
      this.emit('change')
    }
  }

  // 隐藏 overlay
  hide(id: string): void {
    const overlay = this.overlays.get(id)
    if (overlay) {
      overlay.visible = false
      if (this.focusedId === id) {
        this.focusedId = null
      }
      this.emit('hide', id)
      this.emit('change')
    }
  }

  // 设置焦点
  focus(id: string): void {
    const overlay = this.overlays.get(id)
    if (overlay?.visible) {
      this.focusedId = id
      this.emit('focus', id)
    }
  }

  // 获取当前焦点 overlay
  getFocused(): Overlay | undefined {
    if (this.focusedId === null) return undefined
    return this.overlays.get(this.focusedId)
  }

  // 获取所有可见 overlay（按 z-index 排序）
  getVisibleOverlays(): Overlay[] {
    return [...this.overlays.values()]
      .filter(o => o.visible)
      .sort((a, b) => a.zIndex - b.zIndex)
  }

  // 渲染所有 overlay 到帧
  renderOverlays(baseFrame: string[], _screenWidth: number): string[] {
    const frame = [...baseFrame]
    const visible = this.getVisibleOverlays()

    for (const overlay of visible) {
      const lines = overlay.component.render(overlay.width)

      for (let i = 0; i < lines.length && overlay.y + i < frame.length; i++) {
        const line = lines[i]
        if (line === undefined) continue
        const row = overlay.y + i
        if (row >= 0 && row < frame.length) {
          // 将 overlay 行写入帧中的对应位置
          const baseLine = frame[row] ?? ''
          const before = baseLine.slice(0, overlay.x)
          const after = baseLine.slice(overlay.x + overlay.width)
          frame[row] = before + line.padEnd(overlay.width) + after
        }
      }
    }

    return frame
  }

  // 获取 overlay
  get(id: string): Overlay | undefined {
    return this.overlays.get(id)
  }

  // 获取所有 overlay 数量
  getCount(): number {
    return this.overlays.size
  }

  // 清空所有 overlay
  clear(): void {
    this.overlays.clear()
    this.focusedId = null
    this.emit('change')
  }
}

// 工厂函数
export function createOverlayManager(): OverlayManager {
  return new OverlayManager()
}
