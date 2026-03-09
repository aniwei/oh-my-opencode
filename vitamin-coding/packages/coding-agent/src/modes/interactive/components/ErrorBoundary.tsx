import React from 'react'
import { Box, Text } from 'ink'
import { theme } from '../theme'

interface ErrorBoundaryProps {
  children: React.ReactNode
  fallback?: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Error boundary for catching render errors in the TUI.
 * Displays a styled error message instead of crashing.
 */
export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  override render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <Box flexDirection="column" padding={1} borderStyle="round" borderColor={theme.error}>
          <Text bold color={theme.error}>
            Something went wrong
          </Text>
          <Box marginTop={1}>
            <Text color={theme.textMuted}>
              {this.state.error?.message ?? 'Unknown error'}
            </Text>
          </Box>
          {this.state.error?.stack != null && (
            <Box marginTop={1}>
              <Text color={theme.textMuted} dimColor>
                {this.state.error.stack.split('\n').slice(1, 5).join('\n')}
              </Text>
            </Box>
          )}
        </Box>
      )
    }

    return this.props.children
  }
}
