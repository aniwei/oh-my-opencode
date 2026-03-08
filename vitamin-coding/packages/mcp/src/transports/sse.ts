// SSE 传输层 — 通过 Server-Sent Events 与 MCP 服务器通信
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js'
import { BaseTransport } from './base-network'

// SSE MCP 传输（流式事件监听 + HTTP POST 请求发送）
export class SseTransport extends BaseTransport<SSEClientTransport> {
  protected readonly transportType = 'sse'

  protected override createTransport(requestInit: RequestInit): SSEClientTransport {
    return new SSEClientTransport(new URL(this.url), {
      requestInit,
    })
  }
}

// 工厂函数
export function createSseTransport(
  url: string,
  headers: Record<string, string> = {},
): SseTransport {
  return new SseTransport(url, headers)
}
