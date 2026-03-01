// 流式编排入口 — stream() / complete() / streamSimple()
import { ProviderError } from '@vitamin/shared'

import { resolveApiKey } from './api-key-resolver'
import { type EventStream, createEventStream } from './utils/event-stream'

import type { ApiKeyResolverOptions } from './api-key-resolver'
import type { ProviderRegistry } from './providers/registry'
import type {
  AssistantMessage,
  Model,
  StreamContext,
  StreamEvent,
  StreamOptions,
  ThinkingLevel,
} from './types'

// 流编排选项（内部扩展）
export interface StreamOrchestratorOptions {
  providerRegistry: ProviderRegistry
  apiKeyOptions?: ApiKeyResolverOptions
}

// 底层流式 API — 返回 EventStream
export function stream(
  model: Model,
  context: StreamContext,
  options: StreamOptions & StreamOrchestratorOptions,
): EventStream<StreamEvent, AssistantMessage> {
  const eventStream = createEventStream<StreamEvent, AssistantMessage>()

  // 异步启动流
  startStream(model, context, options, eventStream).catch((error: unknown) => {
    const providerError = error instanceof Error ? error : new Error(String(error))
    eventStream.fail(providerError)
  })

  return eventStream
}

// 一次性完成 — await 直接拿到结果
export async function complete(
  model: Model,
  context: StreamContext,
  options: StreamOptions & StreamOrchestratorOptions,
): Promise<AssistantMessage> {
  const eventStream = stream(model, context, options)
  return eventStream.result()
}

// 简化版流式 — 额外接受 thinkingLevel 参数
export function streamSimple(
  model: Model,
  context: Omit<StreamContext, 'thinkingLevel'> & { thinkingLevel?: ThinkingLevel },
  options: StreamOptions & StreamOrchestratorOptions,
): EventStream<StreamEvent, AssistantMessage> {
  return stream(model, context as StreamContext, options)
}

// 内部: 启动流式调用
async function startStream(
  model: Model,
  context: StreamContext,
  options: StreamOptions & StreamOrchestratorOptions,
  eventStream: EventStream<StreamEvent, AssistantMessage>,
): Promise<void> {
  const { providerRegistry, apiKeyOptions, signal, apiKey: explicitKey } = options

  // 获取 Provider
  const provider = providerRegistry.get(model.api)

  // 解析 API Key
  const apiKey = await resolveApiKey(model.provider, apiKeyOptions, explicitKey)

  // 创建 abort 控制器
  const controller = new AbortController()
  eventStream.setAbortController(controller)

  // 合并外部 signal
  const combinedSignal = signal ? AbortSignal.any([signal, controller.signal]) : controller.signal

  // 构造带 key 的选项
  const streamOptions: StreamOptions = {
    ...options,
    apiKey,
    signal: combinedSignal,
  }

  let lastMessage: AssistantMessage | undefined

  try {
    // 遍历 Provider 返回的事件
    for await (const event of provider.stream(model, context, streamOptions, combinedSignal)) {
      eventStream.push(event)

      // 记录最终消息
      if (event.type === 'done') {
        lastMessage = event.message
      }
      if (event.type === 'error') {
        eventStream.fail(event.error)
        return
      }
    }

    // 流完成
    if (lastMessage) {
      eventStream.complete(lastMessage)
    } else {
      eventStream.fail(
        new ProviderError('Stream ended without done event', {
          code: 'PROVIDER_INCOMPLETE_STREAM',
        }),
      )
    }
  } catch (error) {
    if (error instanceof Error) {
      eventStream.fail(error)
    } else {
      eventStream.fail(
        new ProviderError('Stream failed', {
          code: 'PROVIDER_STREAM_ERROR',
          cause: new Error(String(error)),
        }),
      )
    }
  }
}
