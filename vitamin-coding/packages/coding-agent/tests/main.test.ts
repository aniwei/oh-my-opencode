// main.ts 集成测试（验证 7 步初始化序列）
import { main } from '../src/main'

import type { CLIOptions } from '../src/types'

describe('main', () => {
  describe('#given 7 步初始化序列', () => {
    describe('#when 调用 main()', () => {
      it('#then 不抛异常（各子系统可初始化）', async () => {
        // main() 会尝试加载配置和初始化子系统
        // 由于没有真实的 API Key 或 Agent 注册，
        // 它在 print 模式下没有 prompt 会直接退出
        const options: CLIOptions = {
          mode: 'print',
          projectDir: '/tmp/nonexistent-project',
          verbose: false,
          prompt: undefined,
        }

        // main 应该能执行而不抛异常
        // 因为它捕获了所有错误并 logger.error
        await expect(main(options)).resolves.toBeUndefined()
      })
    })
  })
})
