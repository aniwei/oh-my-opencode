import { Box, Text } from 'ink'
import { theme } from '../../theme'

interface HeaderProps {
  sessionID: string
  title?: string
  parentID?: string
  context?: string
  cost?: string
}

/**
 * Session header — shows session title and token/cost info.
 * Data-dependent fields (title, cost, context) are passed as props;
 * real data wired when data layer is connected.
 */
export function Header({
  title,
  parentID,
  context,
  cost,
}: HeaderProps) {
  return (
    <Box flexShrink={0}>
      <Box
        paddingTop={1}
        paddingBottom={1}
        paddingLeft={2}
        paddingRight={1}
        borderStyle="single"
        borderLeft
        borderRight={false}
        borderTop={false}
        borderBottom={false}
        borderColor={theme.border}
        flexShrink={0}
        width="100%"
      >
        {parentID ? (
          <Box flexDirection="column" gap={1}>
            <Box flexDirection="row" justifyContent="space-between">
              <Text bold color={theme.text}>
                Subagent session
              </Text>
              {context != null && (
                <Text color={theme.textMuted}>
                  {context} ({cost ?? '$0.00'})
                </Text>
              )}
            </Box>
            <Box flexDirection="row" gap={2}>
              <Text color={theme.text}>
                Parent <Text color={theme.textMuted}>ctrl+x left</Text>
              </Text>
              <Text color={theme.text}>
                Prev <Text color={theme.textMuted}>ctrl+x [</Text>
              </Text>
              <Text color={theme.text}>
                Next <Text color={theme.textMuted}>ctrl+x ]</Text>
              </Text>
            </Box>
          </Box>
        ) : (
          <Box flexDirection="row" justifyContent="space-between" gap={1}>
            <Text color={theme.text}>
              <Text bold>#</Text>{' '}
              <Text bold>{title ?? 'Untitled'}</Text>
            </Text>
            {context != null && (
              <Text color={theme.textMuted} wrap="truncate">
                {context} ({cost ?? '$0.00'})
              </Text>
            )}
          </Box>
        )}
      </Box>
    </Box>
  )
}
