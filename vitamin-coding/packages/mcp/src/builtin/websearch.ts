// 内置 websearch MCP — 提供网络搜索功能
import type { McpServerConfig } from '../types'

// 内置 MCP 服务器配置列表
export function getBuiltinMcpConfigs(): McpServerConfig[] {
  return [
    {
      name: 'websearch',
      transport: 'http',
      url: 'https://mcp.exa.ai/v1',
      headers: {},
    },
    {
      name: 'context7',
      transport: 'http',
      url: 'https://mcp.context7.com/v1',
      headers: {},
    },
    {
      name: 'grep_app',
      transport: 'http',
      url: 'https://mcp.grep.app/v1',
      headers: {},
    },
  ]
}
