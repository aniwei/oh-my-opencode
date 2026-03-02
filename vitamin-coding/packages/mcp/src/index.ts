// @vitamin/mcp — MCP 协议支持

// MCP 客户端
export { McpClient, createMcpClient } from './mcp-client'

// MCP 注册表
export { McpRegistry, createMcpRegistry } from './mcp-registry'

// MCP 配置加载器
export {
  McpConfigLoader,
  createMcpConfigLoader,
  expandEnvVars,
  expandEnvVarsInObject,
  parseMcpConfig,
  configEntryToServerConfig,
} from './mcp-loader'

// 传输层
export { StdioTransport, createStdioTransport } from './transports/stdio'
export { HttpTransport, createHttpTransport } from './transports/http'
export { SseTransport, createSseTransport } from './transports/sse'

// 内置 MCP
export { getBuiltinMcpConfigs } from './builtin/websearch'

// Skill MCP 管理器
export { SkillMcpManager, createSkillMcpManager } from './skill-mcp-manager'

// OAuth 管理器
export { OAuthManager, createOAuthManager } from './oauth-manager'

// 工具命名/转换
export { formatMcpToolName, parseMcpToolName, mcpResultToToolResult } from './types'

// 类型导出
export type {
  McpTransportType,
  McpServerConfig,
  McpToolDefinition,
  McpToolCallParams,
  McpToolCallResult,
  McpContent,
  McpTransport,
  McpPriority,
  McpRegistration,
  McpConfigFile,
  McpServerConfigEntry,
  OAuthConfig,
  OAuthToken,
  SkillMcpConfig,
} from './types'
