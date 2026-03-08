// OAuth 令牌管理器 — 管理 MCP 服务器的 OAuth 令牌生命周期
import { createLogger } from '@vitamin/shared'

import type { OAuthConfig, OAuthToken } from './types'

const logger = createLogger('mcp:oauth')

// 令牌即将过期的提前量（秒）
const TOKEN_EXPIRY_BUFFER_SECONDS = 60

// OAuth 令牌管理器
export class OAuthManager {
  private readonly tokens: Map<string, OAuthToken> = new Map()

  // 获取令牌（自动刷新已过期的令牌）
  async getToken(
    mcpName: string,
    config: OAuthConfig,
  ): Promise<OAuthToken> {
    const existing = this.tokens.get(mcpName)

    if (existing && !this.isExpired(existing)) {
      return existing
    }

    // 如果有刷新令牌，尝试刷新
    if (existing?.refreshToken && config.refreshUrl) {
      try {
        const refreshed = await this.refreshToken(config, existing.refreshToken)
        this.tokens.set(mcpName, refreshed)
        logger.info(`MCP ${mcpName} OAuth 令牌已刷新`)
        return refreshed
      } catch (error) {
        logger.warn(`MCP ${mcpName} 令牌刷新失败: ${String(error)}`)
      }
    }

    // 请求新令牌
    const token = await this.requestToken(config)
    this.tokens.set(mcpName, token)
    logger.info(`MCP ${mcpName} 获取新 OAuth 令牌`)
    return token
  }

  // 删除令牌
  removeToken(mcpName: string): void {
    this.tokens.delete(mcpName)
  }

  // 清除所有令牌
  clearAll(): void {
    this.tokens.clear()
  }

  // 检查令牌是否即将过期
  private isExpired(token: OAuthToken): boolean {
    const now = Date.now() / 1000
    return token.expiresAt - now < TOKEN_EXPIRY_BUFFER_SECONDS
  }

  // 使用 client credentials 请求新令牌
  private async requestToken(config: OAuthConfig): Promise<OAuthToken> {
    const body = new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: config.clientId,
    })

    if (config.clientSecret) {
      body.set('client_secret', config.clientSecret)
    }

    if (config.scopes && config.scopes.length > 0) {
      body.set('scope', config.scopes.join(' '))
    }

    return this.fetchOAuthToken(config.tokenUrl, body, 'OAuth 请求失败')
  }

  // 使用 refresh_token 刷新令牌
  private async refreshToken(
    config: OAuthConfig,
    refreshToken: string,
  ): Promise<OAuthToken> {
    const url = config.refreshUrl ?? config.tokenUrl

    const body = new URLSearchParams({
      grant_type: 'refresh_token',
      client_id: config.clientId,
      refresh_token: refreshToken,
    })

    if (config.clientSecret) {
      body.set('client_secret', config.clientSecret)
    }

    const token = await this.fetchOAuthToken(url, body, 'OAuth 刷新失败')
    return {
      ...token,
      refreshToken: token.refreshToken ?? refreshToken,
    }
  }

  private async fetchOAuthToken(
    url: string,
    body: URLSearchParams,
    errorPrefix: string,
  ): Promise<OAuthToken> {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    })

    if (!response.ok) {
      throw new Error(`${errorPrefix}: ${String(response.status)}`)
    }

    const data = await response.json() as {
      access_token: string
      refresh_token?: string
      expires_in?: number
      token_type?: string
    }

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() / 1000 + (data.expires_in ?? 3600),
      tokenType: data.token_type ?? 'Bearer',
    }
  }
}

// 工厂函数
export function createOAuthManager(): OAuthManager {
  return new OAuthManager()
}
