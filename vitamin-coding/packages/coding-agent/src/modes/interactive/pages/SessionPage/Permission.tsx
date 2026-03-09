import { useState, useCallback } from 'react'
import { Box, Text, useInput } from 'ink'
import { theme } from '../../theme'

interface PermissionRequest {
  id: string
  tool: string
  description: string
  risk?: 'low' | 'medium' | 'high'
}

interface PermissionProps {
  request: PermissionRequest
  onAllow: (id: string) => void
  onDeny: (id: string) => void
  onAlwaysAllow?: (id: string) => void
}

/**
 * Permission dialog — 3-stage state machine (allow / always / deny).
 * Keyboard-driven: y=allow, a=always, n=deny, Escape=deny.
 */
export function Permission({
  request,
  onAllow,
  onDeny,
  onAlwaysAllow,
}: PermissionProps) {
  const [focused, setFocused] = useState<'allow' | 'always' | 'deny'>('allow')

  const handleAction = useCallback(() => {
    switch (focused) {
      case 'allow':
        onAllow(request.id)
        break
      case 'always':
        onAlwaysAllow?.(request.id) ?? onAllow(request.id)
        break
      case 'deny':
        onDeny(request.id)
        break
    }
  }, [focused, request.id, onAllow, onDeny, onAlwaysAllow])

  useInput((input, key) => {
    if (input === 'y') {
      onAllow(request.id)
    } else if (input === 'a') {
      onAlwaysAllow?.(request.id) ?? onAllow(request.id)
    } else if (input === 'n' || key.escape) {
      onDeny(request.id)
    } else if (key.leftArrow) {
      setFocused((prev) =>
        prev === 'allow' ? 'deny' : prev === 'always' ? 'allow' : 'always',
      )
    } else if (key.rightArrow) {
      setFocused((prev) =>
        prev === 'allow' ? 'always' : prev === 'always' ? 'deny' : 'allow',
      )
    } else if (key.return) {
      handleAction()
    }
  })

  const riskColor =
    request.risk === 'high'
      ? theme.error
      : request.risk === 'medium'
        ? theme.warning
        : theme.info

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.warning}
      paddingLeft={1}
      paddingRight={1}
      width="100%"
    >
      <Box flexDirection="row" gap={1}>
        <Text color={theme.warning} bold>
          Permission Required
        </Text>
        {request.risk != null && (
          <Text color={riskColor}>[{request.risk}]</Text>
        )}
      </Box>

      <Box paddingTop={0}>
        <Text color={theme.text}>
          <Text bold>{request.tool}</Text>: {request.description}
        </Text>
      </Box>

      <Box flexDirection="row" gap={2} paddingTop={1}>
        <Text
          color={focused === 'allow' ? theme.success : theme.textMuted}
          bold={focused === 'allow'}
        >
          [y] Allow
        </Text>
        <Text
          color={focused === 'always' ? theme.info : theme.textMuted}
          bold={focused === 'always'}
        >
          [a] Always
        </Text>
        <Text
          color={focused === 'deny' ? theme.error : theme.textMuted}
          bold={focused === 'deny'}
        >
          [n] Deny
        </Text>
      </Box>
    </Box>
  )
}
