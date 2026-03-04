import { render } from 'ink'
import { App } from './App'
import type { ModeRunner } from '../../types'

export function createInteractiveMode(): ModeRunner {
  return {
    async run(_session, _options) {
      const instance = render(<App />)
      await instance.waitUntilExit()
    },
  }
}
