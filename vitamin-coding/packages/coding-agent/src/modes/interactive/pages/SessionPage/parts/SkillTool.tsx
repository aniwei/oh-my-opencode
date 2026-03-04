import { Box, Text } from 'ink'
import { theme } from '../../../theme.js'
import { Spinner } from '../../../components/Spinner.js'

interface SkillToolProps {
  skillName: string
  status?: 'running' | 'completed' | 'failed'
  output?: string
}

export function SkillTool({ skillName, status, output }: SkillToolProps) {
  return (
    <Box flexDirection="column" paddingLeft={1}>
      <Box flexDirection="row" gap={1}>
        <Text color={theme.accent}>Skill</Text>
        <Text color={theme.text} bold>
          {skillName}
        </Text>
      </Box>
      {status === 'running' && <Spinner color={theme.accent}>executing...</Spinner>}
      {status === 'completed' && output != null && (
        <Box paddingLeft={2}>
          <Text color={theme.textMuted} wrap="wrap">
            {output.length > 300 ? `${output.slice(0, 300)}…` : output}
          </Text>
        </Box>
      )}
      {status === 'failed' && <Text color={theme.error}>✗ skill failed</Text>}
    </Box>
  )
}
