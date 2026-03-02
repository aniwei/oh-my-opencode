// CLI 参数解析测试
import { parseCLI } from '../src/cli'
import { parseCLIFull } from '../src/cli'

describe('parseCLI', () => {
  describe('#given 无参数', () => {
    describe('#when 仅有 node 和脚本路径', () => {
      it('#then 默认为 print 模式', () => {
        const options = parseCLI(['node', 'vitamin'])

        expect(options.mode).toBe('print')
        expect(options.prompt).toBeUndefined()
        expect(options.verbose).toBe(false)
      })
    })
  })

  describe('#given --print 参数', () => {
    describe('#when 指定 --print', () => {
      it('#then 模式为 print', () => {
        const options = parseCLI(['node', 'vitamin', '--print'])

        expect(options.mode).toBe('print')
      })
    })

    describe('#when 指定 -p 简写', () => {
      it('#then 模式为 print', () => {
        const options = parseCLI(['node', 'vitamin', '-p'])

        expect(options.mode).toBe('print')
      })
    })
  })

  describe('#given --json 参数', () => {
    describe('#when 指定 --json', () => {
      it('#then 模式为 json', () => {
        const options = parseCLI(['node', 'vitamin', '--json'])

        expect(options.mode).toBe('json')
      })
    })
  })

  describe('#given --rpc 参数', () => {
    describe('#when 指定 --rpc', () => {
      it('#then 模式为 rpc', () => {
        const options = parseCLI(['node', 'vitamin', '--rpc'])

        expect(options.mode).toBe('rpc')
      })
    })
  })

  describe('#given --model 参数', () => {
    describe('#when 指定 --model claude-opus', () => {
      it('#then model 为指定值', () => {
        const options = parseCLI(['node', 'vitamin', '--model', 'claude-opus'])

        expect(options.model).toBe('claude-opus')
      })
    })

    describe('#when 指定 -m 简写', () => {
      it('#then model 为指定值', () => {
        const options = parseCLI(['node', 'vitamin', '-m', 'gpt-4o'])

        expect(options.model).toBe('gpt-4o')
      })
    })
  })

  describe('#given --verbose 参数', () => {
    describe('#when 指定 --verbose', () => {
      it('#then verbose 为 true', () => {
        const options = parseCLI(['node', 'vitamin', '--verbose'])

        expect(options.verbose).toBe(true)
      })
    })
  })

  describe('#given --max-tokens 参数', () => {
    describe('#when 指定 --max-tokens 4096', () => {
      it('#then maxTokens 为数字', () => {
        const options = parseCLI(['node', 'vitamin', '--max-tokens', '4096'])

        expect(options.maxTokens).toBe(4096)
      })
    })
  })

  describe('#given 裸文本参数', () => {
    describe('#when 提供 prompt 文本', () => {
      it('#then 自动切换为 print 模式', () => {
        const options = parseCLI(['node', 'vitamin', 'Fix', 'the', 'bug'])

        expect(options.mode).toBe('print')
        expect(options.prompt).toBe('Fix the bug')
      })
    })

    describe('#when 显式指定 --json 并提供 prompt', () => {
      it('#then 当前实现会回退到 print 模式', () => {
        const options = parseCLI(['node', 'vitamin', '--json', 'hello', 'world'])

        expect(options.mode).toBe('print')
        expect(options.prompt).toBe('hello world')
      })
    })
  })

  describe('#given --continue 参数', () => {
    describe('#when 指定会话 ID', () => {
      it('#then continueSession 为指定值', () => {
        const options = parseCLI(['node', 'vitamin', '--continue', 'abc-123'])

        expect(options.continueSession).toBe('abc-123')
      })
    })
  })

  describe('#given 组合参数', () => {
    describe('#when 多参数组合', () => {
      it('#then 全部正确解析', () => {
        const options = parseCLI([
          'node',
          'vitamin',
          '--print',
          '--model',
          'claude-opus',
          '--verbose',
          '--max-tokens',
          '8192',
        ])

        expect(options.mode).toBe('print')
        expect(options.model).toBe('claude-opus')
        expect(options.verbose).toBe(true)
        expect(options.maxTokens).toBe(8192)
      })
    })
  })
})

describe('parseCLIFull', () => {
  describe('#given auth subcommand', () => {
    describe('#when running vitamin auth copilot', () => {
      it('#then parses auth as subcommand and keeps args', () => {
        const parsed = parseCLIFull(['node', 'vitamin', 'auth', 'copilot'])

        expect(parsed.subCommand).toBe('auth')
        expect(parsed.subCommandArgs).toBe('copilot')
      })
    })
  })
})
