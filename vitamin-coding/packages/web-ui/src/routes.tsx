import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppShellLayout } from './components/layout/app-shell'
import { LoadingSpinner } from './components/common/loading'
import { HomeRoute } from './routes/home'

const ChatPage = lazy(() => import('./routes/chat').then((m) => ({ default: m.ChatPage })))
const SettingsPage = lazy(() => import('./routes/settings').then((m) => ({ default: m.SettingsPage })))
const SettingsModelsPage = lazy(() => import('./routes/settings-models').then((m) => ({ default: m.SettingsModelsPage })))
const SettingsAgentsPage = lazy(() => import('./routes/settings-agents').then((m) => ({ default: m.SettingsAgentsPage })))

function SuspenseWrapper(props: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<LoadingSpinner label="加载中..." />}>
      {props.children}
    </Suspense>
  )
}

export function AppRoutes() {
  return (
    <Routes>
      <Route element={<AppShellLayout />}>
        <Route path="/app" element={<HomeRoute />} />
        <Route path="/app/chat/:sessionId" element={<SuspenseWrapper><ChatPage /></SuspenseWrapper>} />
        <Route path="/app/settings" element={<SuspenseWrapper><SettingsPage /></SuspenseWrapper>} />
        <Route path="/app/settings/models" element={<SuspenseWrapper><SettingsModelsPage /></SuspenseWrapper>} />
        <Route path="/app/settings/agents" element={<SuspenseWrapper><SettingsAgentsPage /></SuspenseWrapper>} />
      </Route>
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  )
}
