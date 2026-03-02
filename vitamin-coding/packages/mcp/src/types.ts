// @vitamin/mcp 核心类型
import type { ToolResult } from '@vitamin/agent'

// MCP 传输类型
export type McpTransportType = 'stdio' | 'http'

// MCP 服务器配置
export interface McpServerConfig {
  name: string
  transport: McpTransportType
  // stdio 传输
  command?: string
  args?: string[]
  env?: Record<string, string>
  // HTTP 传输
  url?: string
  headers?: Record<string, string>
  // OAuth 配置
  oauth?: OAuthConfig
}

// MCP 工具定义（从 tool/list 返回）
export interface McpToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

// MCP 工具调用参数
export interface McpToolCallParams {
  name: string
  arguments: Record<string, unknown>
}

// MCP 工具调用结果
export interface McpToolCallResult {
  content: McpContent[]
  isError?: boolean
}

// MCP 内容
export interface McpContent {
  type: 'text' | 'image' | 'resource'
  text?: string
  data?: string
  mimeType?: string
}

// MCP 传输接口
export interface McpTransport {
  connect(): Promise<void>
  disconnect(): Promise<void>
  listTools(): Promise<McpToolDefinition[]>
  callTool(params: McpToolCallParams): Promise<McpToolCallResult>
  isConnected(): boolean
}

// MCP 加载优先级（§S10.1）
export type McpPriority = 'builtin' | 'user' | 'skill'

// MCP 注册信息
export interface McpRegistration {
  name: string
  priority: McpPriority
  config: McpServerConfig
  transport?: McpTransport
  tools: McpToolDefinition[]
  connected: boolean
}

// MCP 配置文件格式 (.vitamin/mcp.json)
export interface McpConfigFile {
  mcpServers: Record<string, McpServerConfigEntry>
}

// 配置文件中的单个 MCP 服务器条目
export interface McpServerConfigEntry {
  transport?: McpTransportType
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  headers?: Record<string, string>
}

// OAuth 配置
export interface OAuthConfig {
  clientId: string
  clientSecret?: string
  tokenUrl: string
  refreshUrl?: string
  scopes?: string[]
}

// OAuth 令牌
export interface OAuthToken {
  accessToken: string
  refreshToken?: string
  expiresAt: number
  tokenType: string
}

// Skill MCP 配置 (SKILL.md YAML frontmatter)
export interface SkillMcpConfig {
  name: string
  transport: McpTransportType
  command?: string
  args?: string[]
  url?: string
}

// MCP 工具命名空间格式化（§S10.2: mcp__{mcpName}__{toolName}）
export function formatMcpToolName(mcpName: string, toolName: string): string {
  return `mcp__${mcpName}__${toolName}`
}

// 从命名空间工具名提取 MCP 名和工具名
// 使用双下划线 __ 作为分隔符，MCP 名称允许包含单下划线
export function parseMcpToolName(
  namespacedName: string,
): { mcpName: string; toolName: string } | undefined {
  const match = namespacedName.match(/^mcp__(.+?)__(.+)$/)
  if (!match) return undefined
  const mcpName = match[1]
  const toolName = match[2]
  if (!mcpName || !toolName) return undefined
  return { mcpName, toolName }
}

// MCP 工具转换为 ToolResult
export function mcpResultToToolResult(result: McpToolCallResult): ToolResult {
  return {
    content: result.content.map((c) => {
      if (c.type === 'text') {
        return { type: 'text' as const, text: c.text ?? '' }
      }
      if (c.type === 'image') {
        return {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            mediaType: c.mimeType ?? 'image/png',
            data: c.data ?? '',
          },
        }
      }
      // resource 类型也转为 text
      return { type: 'text' as const, text: c.text ?? JSON.stringify(c) }
    }),
    isError: result.isError,
  }
}
