import { Box, Text } from 'ink'
import { theme } from '../../../theme.js'

interface BlockToolProps {
  name: string
  content?: string
}

export function BlockTool({ name, content }: BlockToolProps) {
  return (
    <Box flexDirection="column" paddingLeft={1}>
      <Text color={theme.info}>{name}</Text>
      {content != null && (
        <Box paddingLeft={2} borderStyle="single" borderLeft borderRight={false} borderTop={false} borderBottom={false} borderColor={theme.borderSubtle}>
          <Text color={theme.textMuted} wrap="wrap">
            {content.length > 500 ? `${content.slice(0, 500)}…` : content}
          </Text>
        </Box>
      )}
    </Box>
  )
}
