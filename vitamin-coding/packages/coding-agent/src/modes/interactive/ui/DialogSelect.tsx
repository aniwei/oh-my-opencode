import { useState, useMemo, useCallback } from 'react'
import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'
import fuzzysort from 'fuzzysort'
import { theme } from '../theme'

export interface SelectOption {
  label: string
  value: string
  description?: string
  category?: string
  keybind?: string
}

interface DialogSelectProps {
  title?: string
  options: SelectOption[]
  onSelect: (value: string) => void
  onClose: () => void
  placeholder?: string
}

/**
 * Fuzzy search select dialog — fuzzysort-based filtering with keyboard nav.
 */
export function DialogSelect({
  title,
  options,
  onSelect,
  onClose,
  placeholder = 'Search...',
}: DialogSelectProps) {
  const [query, setQuery] = useState('')
  const [focusedIndex, setFocusedIndex] = useState(0)

  const filtered = useMemo(() => {
    if (query.trim().length === 0) return options
    const results = fuzzysort.go(query, options, {
      keys: ['label', 'description', 'category'],
      threshold: -10000,
    })
    return results.map((r) => r.obj)
  }, [query, options])

  const handleSelect = useCallback(() => {
    const item = filtered[focusedIndex]
    if (item != null) {
      onSelect(item.value)
    }
  }, [filtered, focusedIndex, onSelect])

  useInput((_input, key) => {
    if (key.escape) {
      onClose()
    } else if (key.upArrow) {
      setFocusedIndex((prev) => Math.max(0, prev - 1))
    } else if (key.downArrow) {
      setFocusedIndex((prev) => Math.min(filtered.length - 1, prev + 1))
    } else if (key.return) {
      handleSelect()
    }
  })

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value)
    setFocusedIndex(0)
  }, [])

  const maxVisible = 10
  const startIdx = Math.max(0, focusedIndex - Math.floor(maxVisible / 2))
  const visibleItems = filtered.slice(startIdx, startIdx + maxVisible)

  return (
    <Box
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.borderActive}
      width={60}
      padding={1}
    >
      {title != null && (
        <Box paddingBottom={1}>
          <Text color={theme.text} bold>
            {title}
          </Text>
        </Box>
      )}

      <Box
        borderStyle="round"
        borderColor={theme.border}
        paddingLeft={1}
        paddingRight={1}
      >
        <TextInput
          value={query}
          onChange={handleQueryChange}
          placeholder={placeholder}
          focus
          showCursor
        />
      </Box>

      <Box flexDirection="column" paddingTop={1}>
        {visibleItems.map((item, i) => {
          const globalIdx = startIdx + i
          const isFocused = globalIdx === focusedIndex
          return (
            <Box
              key={item.value}
              flexDirection="row"
              gap={1}
            >
              <Text color={isFocused ? theme.primary : theme.textMuted}>
                {isFocused ? '▸' : ' '}
              </Text>
              <Box flexDirection="column" flexGrow={1}>
                <Box flexDirection="row" gap={1}>
                  <Text
                    color={isFocused ? theme.text : theme.textMuted}
                    bold={isFocused}
                  >
                    {item.label}
                  </Text>
                  {item.category != null && (
                    <Text color={theme.textMuted} dimColor>
                      [{item.category}]
                    </Text>
                  )}
                  {item.keybind != null && (
                    <Text color={theme.textMuted}>{item.keybind}</Text>
                  )}
                </Box>
                {item.description != null && (
                  <Text color={theme.textMuted} wrap="truncate">
                    {item.description}
                  </Text>
                )}
              </Box>
            </Box>
          )
        })}
        {filtered.length === 0 && (
          <Text color={theme.textMuted}>No results</Text>
        )}
      </Box>

      <Box paddingTop={1}>
        <Text color={theme.textMuted}>
          {filtered.length} / {options.length}
        </Text>
      </Box>
    </Box>
  )
}
