import { Box, Text } from 'ink'
import { theme } from '../../../theme.js'
import { Spinner } from '../../../components/Spinner.js'

interface WebFetchToolProps {
  url: string
  status?: 'fetching' | 'completed' | 'failed'
  statusCode?: number
}

export function WebFetchTool({ url, status, statusCode }: WebFetchToolProps) {
  return (
    <Box flexDirection="column" paddingLeft={1}>
      <Box flexDirection="row" gap={1}>
        <Text color={theme.info}>Fetch</Text>
        <Text color={theme.text}>{url}</Text>
        {statusCode != null && (
          <Text color={statusCode >= 400 ? theme.error : theme.success}>
            [{statusCode}]
          </Text>
        )}
      </Box>
      {status === 'fetching' && <Spinner color={theme.info}>fetching...</Spinner>}
    </Box>
  )
}
