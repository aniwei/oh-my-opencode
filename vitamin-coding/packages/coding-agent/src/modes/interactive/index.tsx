import blessed from 'blessed'
import { Router, Routes, Route, IndexRoute, Link, Navigate } from './components/Router'
import { useLocation } from './components/Router/hooks'
import { render } from 'react-blessed'

import { Home } from './pages/Home'
import { Settings } from './pages/Settings'


const App = () => {
  return (
    <Router defaultUrl="/">
      <Routes>
        <IndexRoute element={<Home />} />
        <Route path="/" element={<Home />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </Router>
  )
}

// Creating our screen
const screen = blessed.screen({
  autoPadding: true,
  smartCSR: true,
  title: 'Vitamin Coding Agent - Interactive Mode',
})

// Adding a way to quit the program
screen.key(['escape', 'q', 'C-c'], () => process.exit(0))

screen.on('resize', () => {
  screen.render()
})

export function createInteractiveMode() {
  return {
    async run() {
      render(<App />, screen)
    },
  }
}