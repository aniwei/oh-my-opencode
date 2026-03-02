import '@mantine/core/styles.css'
import 'katex/dist/katex.min.css'
import { MantineProvider } from '@mantine/core'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useMemo } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { AppRoutes } from './routes'
import { useSettingsStore } from './stores/settings-store'
import { theme } from './theme'

export function App() {
  const { colorScheme } = useSettingsStore()
  const queryClient = useMemo(() => new QueryClient(), [])

  return (
    <QueryClientProvider client={queryClient}>
      <MantineProvider forceColorScheme={colorScheme} theme={theme}>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </MantineProvider>
    </QueryClientProvider>
  )
}
