// HTTP 传输层 — 通过 HTTP 请求与 MCP 服务器通信
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'
import { BaseNetworkTransport } from './base-network'

// HTTP MCP 传输
export class HttpTransport extends BaseNetworkTransport<StreamableHTTPClientTransport> {
  protected readonly transportType = 'http'

  protected override createTransport(requestInit: RequestInit): StreamableHTTPClientTransport {
    return new StreamableHTTPClientTransport(new URL(this.url), {
      requestInit,
    })
  }
}

// 工厂函数
export function createHttpTransport(
  url: string,
  headers: Record<string, string> = {},
): HttpTransport {
  return new HttpTransport(url, headers)
}
