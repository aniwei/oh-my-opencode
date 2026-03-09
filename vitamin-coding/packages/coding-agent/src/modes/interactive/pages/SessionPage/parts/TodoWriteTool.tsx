import { Box, Text } from 'ink'
import { theme } from '../../../theme'
import { TodoItem } from '../../../components/TodoItem'

interface TodoWriteToolProps {
  todos: Array<{ status: string; content: string }>
}

export function TodoWriteTool({ todos }: TodoWriteToolProps) {
  return (
    <Box flexDirection="column" paddingLeft={1}>
      <Text color={theme.accent}>Todo</Text>
      {todos.map((todo, i) => (
        <Box key={i} paddingLeft={1}>
          <TodoItem status={todo.status} content={todo.content} />
        </Box>
      ))}
    </Box>
  )
}
