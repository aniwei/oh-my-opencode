// IME 输入法支持（CJK 双宽度）
import { measureWidth } from '../utils/measure'

// IME 组合状态
export interface ImeState {
  composing: boolean
  text: string
}

// IME 处理器
export class ImeHandler {
  private state: ImeState = { composing: false, text: '' }

  // 开始组合输入
  startComposition(): void {
    this.state = { composing: true, text: '' }
  }

  // 更新组合文本
  updateComposition(text: string): void {
    this.state.text = text
  }

  // 提交组合结果
  commitComposition(): string {
    const text = this.state.text
    this.state = { composing: false, text: '' }
    return text
  }

  // 取消组合
  cancelComposition(): void {
    this.state = { composing: false, text: '' }
  }

  // 获取当前状态
  getState(): ImeState {
    return { ...this.state }
  }

  // 获取组合文本的终端显示宽度
  getCompositionWidth(): number {
    return measureWidth(this.state.text)
  }

  // 是否正在组合输入
  isComposing(): boolean {
    return this.state.composing
  }
}

// 工厂函数
export function createImeHandler(): ImeHandler {
  return new ImeHandler()
}
