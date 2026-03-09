import { useState, useCallback, useMemo } from 'react'
import { Box, Text, useInput } from 'ink'
import TextInput from 'ink-text-input'
import { useNavigate } from 'react-router'
import { useApp } from '../../context/app-context'
import { useTheme } from '../../theme'
import { usePromptHistory } from '../../hooks/use-prompt-history'
import { usePromptStash } from '../../hooks/use-prompt-stash'
import { Autocomplete } from './Autocomplete'

type AutocompleteItem = {
  label: string
  value: string
  type: 'file' | 'agent' | 'command'
  description?: string
}

interface PromptProps {
  hint?: React.ReactNode
  /** When in a session page, submit sends the prompt to the session instead of navigating. */
  onSubmit?: (input: string) => void
  /** Available commands for / completion. */
  commands?: AutocompleteItem[]
  /** Available agents for @ completion. */
  agents?: AutocompleteItem[]
}


export function Prompt({ hint, onSubmit, commands = [], agents = [] }: PromptProps) {
  const [value, setValue] = useState('')
  const [autocompleteVisible, setAutocompleteVisible] = useState(false)
  const [autocompleteQuery, setAutocompleteQuery] = useState('')
  const [autocompleteType, setAutocompleteType] = useState<'command' | 'agent'>('command')

  const { state, dispatch } = useApp()
  const theme = useTheme()
  const navigate = useNavigate()
  const history = usePromptHistory()
  const stash = usePromptStash()

  const handleSubmit = useCallback(
    (input: string) => {
      const trimmed = input.trim()
      if (trimmed.length === 0) return

      history.push(trimmed)

      if (autocompleteVisible) {
        setAutocompleteVisible(false)
      }

      if (trimmed.startsWith('!')) {
        const shellCommand = trimmed.slice(1).trim()
        if (shellCommand.length > 0) {
          dispatch({ type: 'prompt/setMode', mode: 'shell' })
          if (onSubmit) {
            onSubmit(trimmed)
          }
        }
        setValue('')
        return
      }

      if (onSubmit) {
        onSubmit(trimmed)
      } else {
        const sessionID = crypto.randomUUID()
        navigate(`/session/${sessionID}`, {
          state: { initialPrompt: trimmed },
        })
      }
      setValue('')
    },
    [navigate, onSubmit, autocompleteVisible, history, dispatch],
  )

  const handleChange = useCallback((newValue: string) => {
    setValue(newValue)
    history.reset()

    const lastSlash = newValue.lastIndexOf('/')
    const lastAt = newValue.lastIndexOf('@')

    if (lastSlash === 0 && commands.length > 0) {
      setAutocompleteType('command')
      setAutocompleteQuery(newValue.slice(1))
      setAutocompleteVisible(true)
    } else if (lastAt >= 0 && agents.length > 0) {
      setAutocompleteType('agent')
      setAutocompleteQuery(newValue.slice(lastAt + 1))
      setAutocompleteVisible(true)
    } else {
      setAutocompleteVisible(false)
    }
  }, [commands, agents, history])

  const autocompleteItems = useMemo<AutocompleteItem[]>(() => {
    return autocompleteType === 'command' ? commands : agents
  }, [autocompleteType, commands, agents])

  const handleAutocompleteSelect = useCallback(
    (item: AutocompleteItem) => {
      if (item.type === 'command') {
        setValue(`/${item.value} `)
      } else {
        const lastAt = value.lastIndexOf('@')
        const prefix = lastAt >= 0 ? value.slice(0, lastAt) : value
        setValue(`${prefix}@${item.value} `)
      }
      setAutocompleteVisible(false)
    },
    [value],
  )

  const handleAutocompleteClose = useCallback(() => {
    setAutocompleteVisible(false)
  }, [])

  useInput((input, key) => {
    if (key.escape) {
      if (autocompleteVisible) {
        setAutocompleteVisible(false)
      } else if (value.length > 0) {
        setValue('')
      }
      return
    }

    if (key.upArrow && !autocompleteVisible) {
      const prev = history.goUp()
      if (prev !== undefined) {
        setValue(prev)
      }
      return
    }

    if (key.downArrow && !autocompleteVisible) {
      const next = history.goDown()
      if (next !== undefined) {
        setValue(next)
      }
      return
    }

    if (key.ctrl && input === 'j') {
      setValue((v) => v + '↵\n')
      return
    }

    if (key.ctrl && input === 's') {
      if (value.trim().length > 0) {
        stash.push(value)
        setValue('')
      }
      return
    }

    if (key.ctrl && input === 'r') {
      const restored = stash.pop()
      if (restored) {
        setValue(restored)
      }
      return
    }
  }, { isActive: state.promptFocused })

  return (
    <Box flexDirection="column" width="100%" position="relative">
      {autocompleteVisible && (
        <Box
          position="absolute"
          marginTop={-8}
          width="100%"
          height={8}
        >
          <Autocomplete
            items={autocompleteItems}
            query={autocompleteQuery}
            visible={autocompleteVisible}
            onSelect={handleAutocompleteSelect}
            onClose={handleAutocompleteClose}
          />
        </Box>
      )}
      <Box
        backgroundColor={theme.backgroundPanel}
        flexDirection="column"
        width="100%"
        height={4}
        paddingTop={1}
        paddingBottom={1}
      >
        <Box flexDirection="row" paddingLeft={1} paddingRight={1}>
          <Box flexGrow={1}>
            <TextInput
              value={value}
              onChange={handleChange}
              onSubmit={handleSubmit}
              focus={state.promptFocused}
              placeholder="Ask anything..."
              showCursor
            />
          </Box>
          <Box paddingLeft={1} paddingRight={1} backgroundColor={theme.backgroundElement}><Text>/</Text></Box>
        </Box>
        {hint != null && (
          <Box paddingLeft={1} paddingRight={1}>
            {hint}
          </Box>
        )}
      </Box>
    </Box>
  )
}
