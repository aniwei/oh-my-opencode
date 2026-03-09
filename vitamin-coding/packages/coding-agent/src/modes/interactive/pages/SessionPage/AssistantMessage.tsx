import { Box, Text } from 'ink'
import { theme } from '../../theme'
import { Spinner } from '../../components/Spinner'
import type { ToolPartData } from './parts/ToolPart'
import { ToolPart } from './parts/ToolPart'

export interface AssistantMessagePart {
  type: 'text' | 'reasoning' | 'tool'
  content?: string
  tool?: ToolPartData
}

export interface AssistantMessageData {
  id: string
  parts: AssistantMessagePart[]
  model?: string
  isStreaming?: boolean
  timestamp?: number
}

interface AssistantMessageProps {
  message: AssistantMessageData
}

export function AssistantMessage({ message }: AssistantMessageProps) {
  return (
    <Box flexDirection="column" paddingLeft={2} paddingRight={2} paddingTop={1}>
      <Box flexDirection="row" gap={1}>
        <Text color={theme.accent} bold>
          Assistant
        </Text>
        {message.model != null && (
          <Text color={theme.textMuted}>{message.model}</Text>
        )}
        {message.timestamp != null && (
          <Text color={theme.textMuted}>
            {new Date(message.timestamp).toLocaleTimeString()}
          </Text>
        )}
      </Box>

      {message.parts.map((part, i) => {
        switch (part.type) {
          case 'text':
            return (
              <Box key={i} paddingTop={0}>
                <Text color={theme.text} wrap="wrap">
                  {part.content}
                </Text>
              </Box>
            )
          case 'reasoning':
            return (
              <Box key={i} paddingTop={0}>
                <Text color={theme.textMuted} italic wrap="wrap">
                  {part.content}
                </Text>
              </Box>
            )
          case 'tool':
            return part.tool != null ? (
              <ToolPart key={i} data={part.tool} />
            ) : null
          default:
            return null
        }
      })}

      {message.isStreaming && (
        <Box paddingTop={0}>
          <Spinner color={theme.accent}>thinking...</Spinner>
        </Box>
      )}
    </Box>
  )
}
