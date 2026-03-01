// MCP 配置加载器测试
import { describe, expect, it } from 'vitest'

import {
  configEntryToServerConfig,
  expandEnvVars,
  expandEnvVarsInObject,
  parseMcpConfig,
} from '../src/mcp-loader'

describe('MCP 配置加载器', () => {
  describe('#given expandEnvVars（验收 3.3.3）', () => {
    describe('#when 展开简单变量', () => {
      it('#then 替换为环境变量值', () => {
        const env = { HOME: '/home/user', PATH: '/usr/bin' }
        expect(expandEnvVars('${HOME}/.config', env)).toBe('/home/user/.config')
        expect(expandEnvVars('${PATH}:${HOME}/bin', env)).toBe('/usr/bin:/home/user/bin')
      })
    })

    describe('#when 变量不存在', () => {
      it('#then 替换为空字符串', () => {
        expect(expandEnvVars('${NONEXISTENT}', {})).toBe('')
      })
    })

    describe('#when 使用默认值语法', () => {
      it('#then 变量不存在时使用默认值', () => {
        expect(expandEnvVars('${API_KEY:-default-key}', {})).toBe('default-key')
        expect(expandEnvVars('${API_KEY:-default-key}', { API_KEY: 'real-key' })).toBe('real-key')
      })
    })

    describe('#when 无变量引用', () => {
      it('#then 原样返回', () => {
        expect(expandEnvVars('plain text', {})).toBe('plain text')
      })
    })
  })

  describe('#given expandEnvVarsInObject', () => {
    describe('#when 递归展开对象', () => {
      it('#then 所有字符串值被展开', () => {
        const env = { TOKEN: 'secret123' }
        const obj = {
          url: 'https://api.example.com',
          headers: { Authorization: 'Bearer ${TOKEN}' },
          args: ['--token', '${TOKEN}'],
        }
        const result = expandEnvVarsInObject(obj, env)
        expect(result.headers.Authorization).toBe('Bearer secret123')
        expect(result.args[1]).toBe('secret123')
        expect(result.url).toBe('https://api.example.com')
      })
    })

    describe('#when 处理非字符串值', () => {
      it('#then 保留原值', () => {
        const result = expandEnvVarsInObject({ count: 42, flag: true }, {})
        expect(result.count).toBe(42)
        expect(result.flag).toBe(true)
      })
    })
  })

  describe('#given parseMcpConfig', () => {
    describe('#when 解析有效配置', () => {
      it('#then 返回 McpConfigFile', () => {
        const json = JSON.stringify({
          mcpServers: {
            'my-mcp': {
              command: 'node',
              args: ['server.js'],
            },
          },
        })
        const config = parseMcpConfig(json)
        expect(config.mcpServers['my-mcp']).toBeDefined()
        expect(config.mcpServers['my-mcp']?.command).toBe('node')
      })
    })

    describe('#when 解析无效 JSON', () => {
      it('#then 抛出 McpError', () => {
        expect(() => parseMcpConfig('invalid json')).toThrow('MCP 配置解析失败')
      })
    })
  })

  describe('#given configEntryToServerConfig', () => {
    describe('#when 有 command 字段', () => {
      it('#then 自动推断为 stdio 传输', () => {
        const config = configEntryToServerConfig('test-mcp', {
          command: 'node',
          args: ['server.js'],
        })
        expect(config.transport).toBe('stdio')
        expect(config.name).toBe('test-mcp')
      })
    })

    describe('#when 有 url 字段', () => {
      it('#then 自动推断为 http 传输', () => {
        const config = configEntryToServerConfig('http-mcp', {
          url: 'https://api.example.com/mcp',
        })
        expect(config.transport).toBe('http')
      })
    })

    describe('#when 显式指定传输类型', () => {
      it('#then 使用指定的类型', () => {
        const config = configEntryToServerConfig('explicit', {
          transport: 'http',
          url: 'https://example.com',
        })
        expect(config.transport).toBe('http')
      })
    })
  })
})
