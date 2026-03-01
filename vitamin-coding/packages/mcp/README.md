# @vitamin/mcp

MCP (Model Context Protocol) client with stdio and HTTP transports, OAuth authentication, skill-embedded MCP lifecycle management, and built-in MCP server configurations.

## Installation

```bash
pnpm add @vitamin/mcp
```

## Usage

```typescript
import { createMcpClient, createMcpRegistry, createStdioTransport } from '@vitamin/mcp'

const transport = createStdioTransport({ command: 'npx', args: ['-y', 'my-mcp-server'] })
const client = createMcpClient({ transport })

const registry = createMcpRegistry()
registry.register('my-server', client)

const tools = await client.listTools()
```

## Key Exports

| Export | Description |
|--------|-------------|
| `McpClient`, `createMcpClient` | MCP protocol client |
| `McpRegistry`, `createMcpRegistry` | Multi-server MCP registry |
| `McpConfigLoader`, `createMcpConfigLoader` | Config file parser with env var expansion |
| `createStdioTransport` | Stdio transport (subprocess) |
| `createHttpTransport` | HTTP/SSE transport |
| `getBuiltinMcpConfigs` | Built-in MCP server configs (websearch, etc.) |
| `SkillMcpManager`, `createSkillMcpManager` | Skill-embedded MCP lifecycle |
| `OAuthManager`, `createOAuthManager` | OAuth token management |
| `formatMcpToolName`, `parseMcpToolName` | Tool name conventions |

## Types

`McpTransportType`, `McpServerConfig`, `McpToolDefinition`, `McpToolCallParams`, `McpToolCallResult`, `McpTransport`, `McpRegistration`, `OAuthConfig`, `OAuthToken`, `SkillMcpConfig`

## License

See [root README](../../README.md) for details.
