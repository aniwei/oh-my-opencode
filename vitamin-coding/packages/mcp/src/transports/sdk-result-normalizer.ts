import type { McpContent, McpToolCallResult, McpToolDefinition } from '../types'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
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
  const content: McpContent[] = []

  for (const part of rawContent) {
    if (!isRecord(part)) continue
    const type = typeof part.type === 'string' ? part.type : ''

    if (type === 'text') {
      content.push({ type: 'text', text: typeof part.text === 'string' ? part.text : '' })
      continue
    }

    if (type === 'image') {
      content.push({
        type: 'image',
        data: typeof part.data === 'string' ? part.data : '',
        mimeType: typeof part.mimeType === 'string' ? part.mimeType : undefined,
      })
      continue
    }

    if (type === 'resource' && isRecord(part.resource)) {
      const resource = part.resource
      if (typeof resource.text === 'string') {
        content.push({
          type: 'resource',
          text: resource.text,
          mimeType: typeof resource.mimeType === 'string' ? resource.mimeType : undefined,
        })
      } else {
        content.push({
          type: 'resource',
          text: JSON.stringify(resource),
          mimeType: typeof resource.mimeType === 'string' ? resource.mimeType : undefined,
        })
      }
      continue
    }

    if (type === 'audio') {
      content.push({
        type: 'resource',
        text: '[audio content]',
        mimeType: typeof part.mimeType === 'string' ? part.mimeType : undefined,
      })
      continue
    }

    content.push({ type: 'text', text: JSON.stringify(part) })
  }

  return {
    content,
    isError: typeof result.isError === 'boolean' ? result.isError : undefined,
  }
}
