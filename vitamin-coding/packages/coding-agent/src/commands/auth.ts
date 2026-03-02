import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { spawn } from 'node:child_process'

import { createLogger } from '@vitamin/shared'

const logger = createLogger('coding-agent:cmd:auth')

const CLIENT_ID = 'Ov23li8tweQw6odWQebz'
const OAUTH_POLLING_SAFETY_MARGIN_MS = 3000
const USER_AGENT = 'vitamin-coding-agent/0.0.1'

interface CopilotOAuthRecord {
  type: 'oauth'
  refresh: string
  access: string
  expires: number
  provider?: string
  enterpriseUrl?: string
  updatedAt?: number
}

interface ReadlineInterface {
  question: (prompt: string) => Promise<string>
  close: () => void
}

function normalizeDomain(url: string): string {
  return url.replace(/^https?:\/\//, '').replace(/\/$/, '')
}

function getUrls(domain: string): { deviceCodeUrl: string; accessTokenUrl: string } {
  return {
    deviceCodeUrl: `https://${domain}/login/device/code`,
    accessTokenUrl: `https://${domain}/login/oauth/access_token`,
  }
}

function getAuthFilePath(): string {
  const explicit = process.env['VITAMIN_AUTH_FILE']
  if (explicit) return explicit

  const xdgConfigHome = process.env['XDG_CONFIG_HOME']
  const configBase = xdgConfigHome && xdgConfigHome.trim().length > 0
    ? xdgConfigHome
    : join(homedir(), '.config')

  return join(configBase, 'vitamin', 'auth.json')
}

function isCopilotOAuthRecord(value: unknown): value is CopilotOAuthRecord {
  if (!value || typeof value !== 'object') return false
  const record = value as Record<string, unknown>
  return (
    record.type === 'oauth' &&
    typeof record.access === 'string' &&
    typeof record.refresh === 'string' &&
    typeof record.expires === 'number'
  )
}

async function readAuthStore(): Promise<Record<string, unknown>> {
  const authFilePath = getAuthFilePath()
  try {
    const raw = await readFile(authFilePath, 'utf-8')
    const parsed = JSON.parse(raw) as unknown
    if (parsed && typeof parsed === 'object') {
      return parsed as Record<string, unknown>
    }
  } catch {
    return {}
  }

  return {}
}

async function writeAuthStore(store: Record<string, unknown>): Promise<void> {
  const authFilePath = getAuthFilePath()
  await mkdir(dirname(authFilePath), { recursive: true })
  await writeFile(authFilePath, JSON.stringify(store, null, 2) + '\n')
}

async function sleep(ms: number): Promise<void> {
  await new Promise<void>((resolve) => {
    setTimeout(resolve, ms)
  })
}

async function tryOpenBrowser(url: string): Promise<void> {
  const command =
    process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start' : 'xdg-open'

  try {
    const child = spawn(command, [url], { stdio: 'ignore', detached: true })
    child.unref()
  } catch (error) {
    logger.debug(
      'Open browser failed: %s',
      error instanceof Error ? error.message : String(error),
    )
  }
}

async function createStdinReadline(): Promise<ReadlineInterface> {
  const { createInterface } = await import('node:readline')
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  })

  return {
    question: (prompt: string) =>
      new Promise<string>((resolve) => {
        rl.question(prompt, (answer: string) => resolve(answer))
      }),
    close: () => rl.close(),
  }
}

interface CopilotAuthResult {
  providerKey: 'github-copilot' | 'github-copilot-enterprise'
  record: CopilotOAuthRecord
}

async function runCopilotDeviceAuth(): Promise<CopilotAuthResult> {
  const readline = await createStdinReadline()

  try {
    process.stdout.write('\n  请选择 GitHub 部署类型：\n')
    process.stdout.write('    1. GitHub.com\n')
    process.stdout.write('    2. GitHub Enterprise\n\n')

    const deploymentChoice = (await readline.question('  选择部署类型 [1-2, 默认 1]: ')).trim()
    const isEnterprise = deploymentChoice === '2'

    let domain = 'github.com'
    let providerKey: CopilotAuthResult['providerKey'] = 'github-copilot'

    if (isEnterprise) {
      while (true) {
        const rawEnterpriseUrl = (
          await readline.question('  请输入企业域名或 URL (例如 company.ghe.com): ')
        ).trim()

        if (!rawEnterpriseUrl) {
          process.stdout.write('  域名不能为空，请重新输入。\n')
          continue
        }

        try {
          const parsed = rawEnterpriseUrl.includes('://')
            ? new URL(rawEnterpriseUrl)
            : new URL(`https://${rawEnterpriseUrl}`)

          if (!parsed.hostname) {
            process.stdout.write('  域名格式无效，请重新输入。\n')
            continue
          }

          domain = normalizeDomain(parsed.hostname)
          providerKey = 'github-copilot-enterprise'
          break
        } catch {
          process.stdout.write('  URL 格式无效，请重新输入。\n')
        }
      }
    }

    const urls = getUrls(domain)

    const deviceResponse = await fetch(urls.deviceCodeUrl, {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
        'User-Agent': USER_AGENT,
      },
      body: JSON.stringify({
        client_id: CLIENT_ID,
        scope: 'read:user',
      }),
    })

    if (!deviceResponse.ok) {
      throw new Error(`Failed to initiate device authorization (${String(deviceResponse.status)})`)
    }

    const deviceData = (await deviceResponse.json()) as {
      verification_uri: string
      user_code: string
      device_code: string
      interval: number
    }

    process.stdout.write('\n  登录 GitHub Copilot\n')
    process.stdout.write(`  ${deviceData.verification_uri}\n`)
    process.stdout.write(`  请输入验证码: ${deviceData.user_code}\n`)
    process.stdout.write('  正在等待授权完成...\n\n')

    await tryOpenBrowser(deviceData.verification_uri)

    while (true) {
      const response = await fetch(urls.accessTokenUrl, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
          'User-Agent': USER_AGENT,
        },
        body: JSON.stringify({
          client_id: CLIENT_ID,
          device_code: deviceData.device_code,
          grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
        }),
      })

      if (!response.ok) {
        throw new Error(`Token polling failed (${String(response.status)})`)
      }

      const data = (await response.json()) as {
        access_token?: string
        error?: string
        interval?: number
      }

      if (data.access_token) {
        const record: CopilotOAuthRecord = {
          type: 'oauth',
          refresh: data.access_token,
          access: data.access_token,
          expires: 0,
          updatedAt: Date.now(),
          ...(providerKey === 'github-copilot-enterprise' ? { enterpriseUrl: domain } : {}),
        }

        return { providerKey, record }
      }

      if (data.error === 'authorization_pending') {
        await sleep(deviceData.interval * 1000 + OAUTH_POLLING_SAFETY_MARGIN_MS)
        continue
      }

      if (data.error === 'slow_down') {
        let nextInterval = (deviceData.interval + 5) * 1000
        const serverInterval = data.interval
        if (serverInterval && typeof serverInterval === 'number' && serverInterval > 0) {
          nextInterval = serverInterval * 1000
        }
        await sleep(nextInterval + OAUTH_POLLING_SAFETY_MARGIN_MS)
        continue
      }

      if (data.error) {
        throw new Error(`OAuth failed: ${data.error}`)
      }

      await sleep(deviceData.interval * 1000 + OAUTH_POLLING_SAFETY_MARGIN_MS)
    }
  } finally {
    readline.close()
  }
}

export async function readStoredCopilotAuth(): Promise<CopilotOAuthRecord | undefined> {
  const store = await readAuthStore()
  const primary = store['github-copilot']
  if (isCopilotOAuthRecord(primary)) return primary

  const enterprise = store['github-copilot-enterprise']
  if (isCopilotOAuthRecord(enterprise)) return enterprise

  return undefined
}

export async function executeAuthCommand(_projectDir: string, argsStr: string): Promise<void> {
  const firstArg = argsStr.trim().split(/\s+/)[0]
  if (firstArg && firstArg !== 'copilot' && firstArg !== 'github-copilot') {
    process.stderr.write('错误：目前仅支持 `vitamin auth copilot`。\n')
    process.stderr.write('用法：vitamin auth [copilot]\n')
    process.exitCode = 1
    return
  }

  process.stdout.write('\nvitamin auth — GitHub Copilot 授权\n')
  process.stdout.write('─'.repeat(50) + '\n')

  const { providerKey, record } = await runCopilotDeviceAuth()
  const store = await readAuthStore()

  store[providerKey] = record
  store['github-copilot'] = {
    ...record,
    provider: providerKey,
  }

  await writeAuthStore(store)

  process.stdout.write('\n  授权成功，已保存本地凭据。\n')
  process.stdout.write('  你现在可以直接使用 Copilot 模型，例如：github-copilot/claude-sonnet-4\n\n')
}

export function createAuthCommandHelp(): string {
  return `
vitamin auth — 认证管理

用法:
  vitamin auth copilot       使用 GitHub Device Flow 登录 Copilot

说明:
  - 授权流程参照 opencode 的 GitHub Copilot OAuth Device Flow
  - 令牌保存在 ~/.config/vitamin/auth.json
`.trim()
}
