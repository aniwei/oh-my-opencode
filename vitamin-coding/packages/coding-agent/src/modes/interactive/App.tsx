import { MemoryRouter, Routes, Route } from 'react-router'
import { Box, useStdout } from 'ink'
import { AppProvider } from './context/app-context'
import { HomePage } from './pages/HomePage'
import { SessionPage } from './pages/SessionPage/index'
import { DialogOverlay } from './ui/dialog'
import { Toast } from './ui/toast'
import { ErrorBoundary } from './components/ErrorBoundary'
import { ThemeProvider, useTheme } from './theme'

export function App() {
  const stdout = useStdout().stdout
  const columns = stdout.columns || 80
  const rows = stdout.rows || 24

  return (
    <ThemeProvider>
      <AppLayout columns={columns} rows={rows} />
    </ThemeProvider>
  )
}

function AppLayout({
  columns,
  rows,
}: {
  columns: number
  rows: number
}) {
  const theme = useTheme()

  return (
    <Box flexDirection="column" width={columns} height={rows} backgroundColor={theme.background}>
      <MemoryRouter>
        <AppProvider>
          <ErrorBoundary>
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/session/:sessionID" element={<SessionPage />} />
            </Routes>
            <DialogOverlay />
            <Toast />
          </ErrorBoundary>
        </AppProvider>
      </MemoryRouter>
    </Box>
  )
}
