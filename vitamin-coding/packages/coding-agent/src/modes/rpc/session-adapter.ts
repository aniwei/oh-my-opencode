// AgentSession → VitaminAgent 适配器
// AgentSession 是 coding-agent 内部接口，VitaminAgent 是 SDK 公开接口
// 适配层桥接两者的差异（prompt 返回类型、conversation、steer、事件系统等）
import { z } from 'zod'

import type {
  VitaminAgent,
  VitaminAgentState,
  AgentStream,
  StreamEvent,
  ConversationHandle,
  ExternalToolDefinition,
  AgentEventName,
  AgentEventHandler,
} from '@vitamin/sdk'
import type { AgentSession, AgentSessionResult } from '../../types'

// 将 AgentSession 适配为 VitaminAgent
export function adaptSessionToAgent(session: AgentSession): VitaminAgent {
  const eventListeners = new Map<string, Set<(...args: unknown[]) => void>>()
  const externalTools = new Map<string, ExternalToolDefinition>()
  let conversationHistory: AgentSessionResult[] = []

  function emitEvent<E extends AgentEventName>(
    event: E,
    payload: Parameters<AgentEventHandler<E>>[0],
  ): void {
    const listeners = eventListeners.get(event)
    if (listeners) {
      for (const listener of listeners) {
        try {
          listener(payload)
        } catch {
          // 事件处理器错误不应中断主流程
        }
      }
    }
  }

  // 将 AgentSessionResult 包装为 AgentStream
  function wrapResultAsStream(
    resultPromise: Promise<AgentSessionResult>,
  ): AgentStream {
    let aborted = false

    const resultProxy = resultPromise.then(
      (r) => r,
      (e: Error) => { throw e },
    )

    emitEvent('stream_start', { model: session.state.currentModel })

    resultProxy.then(
      (r) => {
        emitEvent('stream_end', {
          tokenUsage: { input: r.tokens.input, output: r.tokens.output },
        })
        emitEvent('done', { messageCount: session.state.messageCount })
      },
      (error: Error) => {
        emitEvent('error', { message: error.message })
      },
    )

    const stream: AgentStream = {
      async *[Symbol.asyncIterator](): AsyncGenerator<StreamEvent> {
        yield { type: 'start' }

        try {
          const result = await resultProxy
          if (!aborted) {
            yield { type: 'text_delta', text: result.response }

            for (const tc of result.toolCalls) {
              yield {
                type: 'tool_call',
                name: tc.name,
                args: tc.args as Record<string, unknown>,
              }
              yield {
                type: 'tool_result',
                name: tc.name,
                result: tc.result ?? '',
              }
            }

            yield { type: 'done', result }
          }
        } catch (error) {
          yield {
            type: 'error',
            error: error instanceof Error ? error.message : String(error),
          }
        }
      },

      async result(): Promise<AgentSessionResult> {
        return resultProxy
      },

      abort(): void {
        aborted = true
        session.abort()
      },
    }

    return stream
  }

  return {
    prompt(text: string): AgentStream {
      const resultPromise = session.prompt(text)
      return wrapResultAsStream(resultPromise)
    },

    conversation(): ConversationHandle {
      conversationHistory = []
      let turnCount = 0
      let ended = false

      return {
        send(text: string): AgentStream {
          if (ended) {
            throw new Error('Conversation has ended')
          }
          turnCount++
          const resultPromise = session.prompt(text)
          const stream = wrapResultAsStream(resultPromise)

          resultPromise.then((r) => {
            conversationHistory.push(r)
          }).catch(() => {
            // 错误已通过 stream 传播
          })

          return stream
        },

        getHistory(): AgentSessionResult[] {
          return [...conversationHistory]
        },

        get turnCount(): number {
          return turnCount
        },

        end(): void {
          ended = true
        },
      }
    },

    steer(message: string): void {
      // steer 作为系统级注入：通过下一次 prompt 的前缀实现
      // 简单实现：记录 steer 消息供下一次 prompt 使用
      session.prompt(`[System steering]: ${message}`).catch(() => {
        // steer 是 fire-and-forget，错误不回传
      })
    },

    abort(): void {
      session.abort()
    },

    getState(): VitaminAgentState {
      return {
        model: session.state.currentModel,
        isRunning: session.state.isRunning,
        messageCount: session.state.messageCount,
        totalTokens: {
          input: session.state.totalTokens.input,
          output: session.state.totalTokens.output,
        },
      }
    },

    async dispose(): Promise<void> {
      eventListeners.clear()
      externalTools.clear()
      conversationHistory = []
      await session.dispose()
    },

    registerTool(tool: ExternalToolDefinition): () => void {
      externalTools.set(tool.name, tool)
      // 通过 session 的 subsystems.toolRegistry 注册
      const toolRegistry = session.subsystems.toolRegistry
      const wrappedTool = {
        name: tool.name,
        description: tool.description,
        parameters: z.object({}).passthrough(),
        execute: async (_id: string, args: unknown, _signal: AbortSignal) => {
          const output = await tool.execute((args as Record<string, unknown>) ?? {})
          return {
            content: [{ type: 'text' as const, text: output }],
          }
        },
      }
      toolRegistry.register(wrappedTool)

      return () => {
        externalTools.delete(tool.name)
        toolRegistry.unregister(tool.name)
      }
    },

    on<E extends AgentEventName>(
      event: E,
      handler: AgentEventHandler<E>,
    ): () => void {
      let listeners = eventListeners.get(event)
      if (!listeners) {
        listeners = new Set()
        eventListeners.set(event, listeners)
      }
      const wrappedHandler = handler as (...args: unknown[]) => void
      listeners.add(wrappedHandler)

      return () => {
        listeners!.delete(wrappedHandler)
        if (listeners!.size === 0) {
          eventListeners.delete(event)
        }
      }
    },
  }
}
