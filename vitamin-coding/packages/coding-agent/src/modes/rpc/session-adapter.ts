import type { AgentSession } from '../../types'
import type { RpcAgent, RpcAgentState } from './rpc-types'

export function adaptSessionToAgent(session: AgentSession): RpcAgent {
  return {
    prompt(text: string) {
      const resultPromise = session.prompt(text)
      return {
        result() {
          return resultPromise
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

    getState(): RpcAgentState {
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
      await session.dispose()
    },
  }
}
