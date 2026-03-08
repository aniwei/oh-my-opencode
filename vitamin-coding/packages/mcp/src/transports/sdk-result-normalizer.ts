import type { McpContent, McpToolCallResult, McpToolDefinition } from '../types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function toStringOrEmpty(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

function toOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

function normalizeContentPart(part: Record<string, unknown>): McpContent {
  const type = toStringOrEmpty(part.type)

  if (type === 'text') {
    return { type: 'text', text: toStringOrEmpty(part.text) }
  }

  if (type === 'image') {
    return {
      type: 'image',
      data: toStringOrEmpty(part.data),
      mimeType: toOptionalString(part.mimeType),
    }
  }

  if (type === 'resource' && isRecord(part.resource)) {
    const resource = part.resource
    return {
      type: 'resource',
      text: typeof resource.text === 'string' ? resource.text : JSON.stringify(resource),
      mimeType: toOptionalString(resource.mimeType),
    }
  }

  if (type === 'audio') {
    return {
      type: 'resource',
      text: '[audio content]',
      mimeType: toOptionalString(part.mimeType),
    }
  }

  return { type: 'text', text: JSON.stringify(part) }
}

export function normalizeToolsResult(result: unknown): McpToolDefinition[] {
  if (!isRecord(result)) return []
  const tools = Array.isArray(result.tools) ? result.tools : []

  return tools
    .filter(isRecord)
    .map((tool) => ({
      name: typeof tool.name === 'string' ? tool.name : '',
      description: typeof tool.description === 'string' ? tool.description : '',
      inputSchema: isRecord(tool.inputSchema) ? tool.inputSchema : {},
    }))
    .filter((tool) => tool.name.length > 0)
}

export function normalizeCallToolResult(result: unknown): McpToolCallResult {
  if (!isRecord(result)) {
    return { content: [] }
  }

  const rawContent = Array.isArray(result.content) ? result.content : []
  const content = rawContent.filter(isRecord).map(normalizeContentPart)

  return {
    content,
    isError: typeof result.isError === 'boolean' ? result.isError : undefined,
  }
}
