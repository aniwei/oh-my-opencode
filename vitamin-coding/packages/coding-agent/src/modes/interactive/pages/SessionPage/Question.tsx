import { useState, useCallback } from 'react'
import { Box, Text, useInput } from 'ink'
import { theme } from '../../theme.js'

interface QuestionOption {
  label: string
  value: string
}

interface QuestionData {
  id: string
  text: string
  options?: QuestionOption[]
  multiSelect?: boolean
}

interface QuestionProps {
  questions: QuestionData[]
  onAnswer: (questionId: string, answer: string | string[]) => void
}

/**
 * Multi-question tabs with single/multiple select and custom answer input.
 * Keyboard navigation: up/down to move, space to toggle, enter to confirm.
 */
export function Question({ questions, onAnswer }: QuestionProps) {
  const [activeTab, setActiveTab] = useState(0)
  const [selectedIndices, setSelectedIndices] = useState<Set<number>>(new Set())
  const [focusedIndex, setFocusedIndex] = useState(0)

  const current = questions[activeTab]
  if (current == null) return null

  const options = current.options ?? []

  const handleSubmit = useCallback(() => {
    if (current.multiSelect) {
      const values = Array.from(selectedIndices).map(
        (i) => options[i]?.value ?? '',
      )
      onAnswer(current.id, values)
    } else {
      const value = options[focusedIndex]?.value ?? ''
      onAnswer(current.id, value)
    }
  }, [current, focusedIndex, selectedIndices, options, onAnswer])

  useInput((input, key) => {
    if (key.upArrow) {
      setFocusedIndex((prev) => Math.max(0, prev - 1))
    } else if (key.downArrow) {
      setFocusedIndex((prev) => Math.min(options.length - 1, prev + 1))
    } else if (input === ' ' && current.multiSelect) {
      setSelectedIndices((prev) => {
        const next = new Set(prev)
        if (next.has(focusedIndex)) {
          next.delete(focusedIndex)
        } else {
          next.add(focusedIndex)
        }
        return next
      })
    } else if (key.return) {
      handleSubmit()
    } else if (key.tab) {
      setActiveTab((prev) => (prev + 1) % questions.length)
      setFocusedIndex(0)
      setSelectedIndices(new Set())
    }
  })

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.info}
      paddingLeft={1}
      paddingRight={1}
      width="100%"
    >
      {/* Tab bar */}
      {questions.length > 1 && (
        <Box flexDirection="row" gap={2} paddingBottom={1}>
          {questions.map((q, i) => (
            <Text
              key={q.id}
              color={i === activeTab ? theme.text : theme.textMuted}
              bold={i === activeTab}
              underline={i === activeTab}
            >
              Q{i + 1}
            </Text>
          ))}
        </Box>
      )}

      {/* Question text */}
      <Box paddingBottom={1}>
        <Text color={theme.text} wrap="wrap">
          {current.text}
        </Text>
      </Box>

      {/* Options */}
      {options.map((opt, i) => {
        const isFocused = i === focusedIndex
        const isSelected = current.multiSelect && selectedIndices.has(i)
        const prefix = current.multiSelect
          ? isSelected
            ? '[x]'
            : '[ ]'
          : isFocused
            ? '●'
            : '○'

        return (
          <Box key={opt.value} flexDirection="row" gap={1}>
            <Text
              color={isFocused ? theme.text : theme.textMuted}
              bold={isFocused}
            >
              {prefix}
            </Text>
            <Text color={isFocused ? theme.text : theme.textMuted}>
              {opt.label}
            </Text>
          </Box>
        )
      })}

      {/* Submit hint */}
      <Box paddingTop={1}>
        <Text color={theme.textMuted}>
          {current.multiSelect ? 'Space to toggle, ' : ''}Enter to confirm
          {questions.length > 1 ? ', Tab for next question' : ''}
        </Text>
      </Box>
    </Box>
  )
}
