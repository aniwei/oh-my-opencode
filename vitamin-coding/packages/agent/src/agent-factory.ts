// Agent 工厂 — 便捷创建 Agent 实例
import { stream as aiStream } from '@vitamin/ai'

import { Agent } from './agent'

import type { ProviderRegistry, StreamContext } from '@vitamin/ai'
import type { StreamFn } from './agent-loop'
import type { AgentConfig } from './types'

// 带 ProviderRegistry 的扩展配置
export interface AgentFactoryConfig extends AgentConfig {
  providerRegistry?: ProviderRegistry
  apiKey?: string
}

// 从 ProviderRegistry 构建 streamFn
function createStreamFnFromRegistry(
  model: AgentConfig['model'],
  providerRegistry: ProviderRegistry,
  apiKey?: string,
): StreamFn {
  return (context: StreamContext, signal: AbortSignal) => {
    return aiStream(model, context, {
      providerRegistry,
      apiKeyOptions: apiKey ? { keys: { [model.provider]: apiKey } } : undefined,
      signal,
    })
  }
}

// 工厂函数 — 创建 Agent
export function createAgent(config: AgentFactoryConfig): Agent {
  // 如果提供了 providerRegistry 但没有 streamFn，自动构建
  let streamFn = config.streamFn
  if (!streamFn && config.providerRegistry) {
    streamFn = createStreamFnFromRegistry(config.model, config.providerRegistry, config.apiKey)
  }

  return new Agent({
    ...config,
    streamFn,
  })
}
