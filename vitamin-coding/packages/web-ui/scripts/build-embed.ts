import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { resolve } from 'node:path'

const WEB_UI_DIST = resolve(import.meta.dirname, '..', 'dist')
const SERVER_WEB_UI = resolve(import.meta.dirname, '..', '..', 'server', 'dist', 'web-ui')

function main() {
  if (!existsSync(WEB_UI_DIST)) {
    console.error('Error: web-ui dist/ not found. Run `pnpm build` first.')
    process.exit(1)
  }

  if (existsSync(SERVER_WEB_UI)) {
    rmSync(SERVER_WEB_UI, { recursive: true })
  }

  mkdirSync(SERVER_WEB_UI, { recursive: true })

  cpSync(WEB_UI_DIST, SERVER_WEB_UI, { recursive: true })

  console.log(`Embedded web-ui dist → ${SERVER_WEB_UI}`)
}

main()
