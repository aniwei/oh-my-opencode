import { createTheme } from '@mantine/core'

const brand = [
  '#edf2ff',
  '#dbe4ff',
  '#bac8ff',
  '#91a7ff',
  '#748ffc',
  '#5c7cfa',
  '#4c6ef5',
  '#4263eb',
  '#3b5bdb',
  '#364fc7',
] as const

export const theme = createTheme({
  primaryColor: 'brand',
  colors: {
    brand,
  },
  defaultRadius: 'md',
  fontFamily: "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  fontFamilyMonospace: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
  other: {
    chatBg: '#1a1b1e',
    sidebarBg: '#141517',
    panelBg: '#202227',
    messageBgUser: '#2c2e33',
    messageBgAssistant: 'transparent',
    codeBlockBg: '#25262b',
    thinkingBg: '#1f2024',
    borderSubtle: '#373a40',
  },
})
