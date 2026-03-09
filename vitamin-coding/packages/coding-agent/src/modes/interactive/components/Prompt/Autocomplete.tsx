import { useState, useMemo, useCallback } from 'react'
import { Box, Text, useInput } from 'ink'
import fuzzysort from 'fuzzysort'
import { useTheme } from '../../theme'

interface AutocompleteItem {
  label: string
  value: string
  type: 'file' | 'agent' | 'command'
  description?: string
}

interface AutocompleteProps {
  items: AutocompleteItem[]
  query: string
  visible: boolean
  onSelect: (item: AutocompleteItem) => void
  onClose: () => void
}

export function Autocomplete({
  items,
  query,
  visible,
  onSelect,
  onClose,
}: AutocompleteProps) {
  const [focusedIndex, setFocusedIndex] = useState(0)
  const theme = useTheme()

  const filtered = useMemo(() => {
    if (query.length === 0) return items.slice(0, 15)
    const results = fuzzysort.go(query, items, {
      keys: ['label', 'value'],
      threshold: -10000,
      limit: 15,
    })
    return results.map((r) => r.obj)
  }, [query, items])

  const handleSelect = useCallback(() => {
    const item = filtered[focusedIndex]
    if (item != null) {
      onSelect(item)
    }
  }, [filtered, focusedIndex, onSelect])

  useInput((_input, key) => {
    if (key.escape) {
      onClose()
    } else if (key.upArrow) {
      setFocusedIndex((prev) => Math.max(0, prev - 1))
    } else if (key.downArrow) {
      setFocusedIndex((prev) => Math.min(filtered.length - 1, prev + 1))
    } else if (key.return || key.tab) {
      handleSelect()
    }
  }, { isActive: visible })

  if (!visible || filtered.length === 0) return null

  const typeIcon = (type: AutocompleteItem['type']) => {
    switch (type) {
      case 'file':
        return '📄'
      case 'agent':
        return '🤖'
      case 'command':
        return '/'
    }
  }

  return (
    <Box
      flexDirection="column"
      backgroundColor={theme.backgroundElement}
      width="100%"
    >
      {filtered.map((item, i) => {
        const isFocused = i === focusedIndex
        return (
          <Box backgroundColor={isFocused ? theme.secondary : ''} key={item.value} flexDirection="row" gap={1}>
            <Text color={theme.textMuted}>{typeIcon(item.type)}</Text>
            <Text
              color={isFocused ? theme.text : theme.textMuted}
              bold={isFocused}
            >
              {item.label}
            </Text>
            {item.description != null && (
              <Text color={theme.textMuted} dimColor>
                {item.description}
              </Text>
            )}
          </Box>
        )
      })}
    </Box>
  )
}
