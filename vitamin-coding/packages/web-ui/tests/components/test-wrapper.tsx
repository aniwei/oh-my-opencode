import { MantineProvider } from '@mantine/core'
import type { ReactNode } from 'react'
import { theme } from '../../src/theme'

export function TestWrapper(props: { children: ReactNode }) {
  return (
    <MantineProvider defaultColorScheme="dark" theme={theme}>
      {props.children}
    </MantineProvider>
  )
}
