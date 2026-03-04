import { useState } from 'react'
import { Box, Text, useInput } from 'ink'
import { useApp } from '../context/app-context.js'
import { theme } from '../theme.js'

interface SkillItem {
  name: string
  description: string
  enabled: boolean
  source: 'builtin' | 'project' | 'user'
}

interface SkillDialogProps {
  skills: SkillItem[]
  onToggle: (name: string) => void
}

/**
 * Dialog for browsing and toggling skills. Phase 6.
 */
export function SkillDialog({ skills, onToggle }: SkillDialogProps) {
  const [focusedIndex, setFocusedIndex] = useState(0)
  const { dispatch } = useApp()

  useInput((_input, key) => {
    if (key.escape) {
      dispatch({ type: 'dialog/pop' })
    }
    if (key.upArrow) {
      setFocusedIndex((prev) => Math.max(0, prev - 1))
    }
    if (key.downArrow) {
      setFocusedIndex((prev) => Math.min(skills.length - 1, prev + 1))
    }
    if (key.return) {
      const skill = skills[focusedIndex]
      if (skill) {
        onToggle(skill.name)
      }
    }
  })

  const sourceColor = (source: SkillItem['source']) => {
    switch (source) {
      case 'builtin':
        return theme.info
      case 'project':
        return theme.accent
      case 'user':
        return theme.success
    }
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color={theme.primary}>
        Skills
      </Text>
      <Box flexDirection="column" marginTop={1}>
        {skills.length === 0 ? (
          <Text color={theme.textMuted}>No skills loaded</Text>
        ) : (
          skills.map((skill, i) => {
            const isFocused = i === focusedIndex
            return (
              <Box key={skill.name} flexDirection="row" gap={1}>
                <Text color={skill.enabled ? theme.success : theme.textMuted}>
                  {skill.enabled ? '●' : '○'}
                </Text>
                <Text
                  color={isFocused ? theme.text : theme.textMuted}
                  bold={isFocused}
                >
                  {skill.name}
                </Text>
                <Text color={sourceColor(skill.source)} dimColor>
                  [{skill.source}]
                </Text>
                <Text color={theme.textMuted} dimColor>
                  {skill.description}
                </Text>
              </Box>
            )
          })
        )}
      </Box>
      <Box marginTop={1}>
        <Text color={theme.textMuted} dimColor>
          ↑↓ navigate · Enter toggle · Esc to close
        </Text>
      </Box>
    </Box>
  )
}
