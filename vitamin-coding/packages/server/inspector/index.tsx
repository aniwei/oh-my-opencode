import React from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import { createVitaminTheme } from '@vitamin/ui-kit'
import { App } from './app'

import '@mantine/core/styles.css'

const theme = createVitaminTheme('light')

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <React.StrictMode>
      <MantineProvider theme={theme} defaultColorScheme="light">
        <App />
      </MantineProvider>
    </React.StrictMode>
  )
}
