// 工具拦截包装器 — Extension 可通过 tool.call/tool.result 事件阻止或修改工具调用
import { createLogger } from '@vitamin/shared'

import type { ToolResult } from '@vitamin/agent'

import type { ExtensionEventBus } from './event-bus'
import type { ToolInterceptEvent, ToolResultInterceptEvent } from './types'

const logger = createLogger('extension:tool-wrapper')

// 工具拦截结果
export interface ToolInterceptResult {
  // 是否被阻止
  prevented: boolean
  // 替代结果（当 prevented=true 时使用）
  replacement?: ToolResult
}

// 工具结果修改结果
export interface ToolResultModifyResult {
  // 最终结果（可能被修改）
  result: ToolResult
  // 是否被修改
  modified: boolean
}

// 用于拦截工具调用的包装器
export class ToolWrapper {
  constructor(private readonly eventBus: ExtensionEventBus) {}

  // 在工具执行前调用，检查是否有 Extension 阻止了该调用
  async interceptToolCall(
    toolName: string,
    toolCallId: string,
    args: Record<string, unknown>,
  ): Promise<ToolInterceptResult> {
    const event: ToolInterceptEvent = {
      toolName,
      toolCallId,
      args,
      preventDefault: false,
    }

    try {
      await this.eventBus.emit('tool.call', event)
    } catch (error) {
      // 拦截异常不影响主流程
      logger.error(`工具拦截异常，fallthrough 到原始执行: ${String(error)}`)
      return { prevented: false }
    }

    if (event.preventDefault) {
      logger.info(`工具 ${toolName} 调用被 Extension 阻止`)
      return {
        prevented: true,
        replacement: event.replacement,
      }
    }

    return { prevented: false }
  }

  // 在工具执行后调用，检查是否有 Extension 修改了结果
  async interceptToolResult(
    toolName: string,
    toolCallId: string,
    result: ToolResult,
  ): Promise<ToolResultModifyResult> {
    const event: ToolResultInterceptEvent = {
      toolName,
      toolCallId,
      result,
    }

    try {
      await this.eventBus.emit('tool.result', event)
    } catch (error) {
      // 拦截异常不影响主流程
      logger.error(`工具结果拦截异常，使用原始结果: ${String(error)}`)
      return { result, modified: false }
    }

    if (event.replacement) {
      logger.info(`工具 ${toolName} 结果被 Extension 修改`)
      return {
        result: event.replacement,
        modified: true,
      }
    }

    return { result, modified: false }
  }
}

// 工厂函数
export function createToolWrapper(eventBus: ExtensionEventBus): ToolWrapper {
  return new ToolWrapper(eventBus)
}
