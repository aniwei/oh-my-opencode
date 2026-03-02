// RPC 模式 — JSON-RPC 2.0 服务器，供 SDK 远程调用 (§S12.1)
import { createRpcServer } from '@vitamin/sdk'
import { createLogger } from '@vitamin/shared'

import { adaptSessionToAgent } from './session-adapter'

import type { AgentSession, CLIOptions, ModeRunner } from '../../types'

const logger = createLogger('coding-agent:rpc')

export function createRpcMode(): ModeRunner {
  return {
    async run(session: AgentSession, _options: CLIOptions): Promise<void> {
      // 将 AgentSession 适配为 VitaminAgent 接口
      const agent = adaptSessionToAgent(session)

      // 解析 socket 路径：优先环境变量，其次 CLI 选项
      const socketPath = process.env['VITAMIN_RPC_SOCKET'] ?? undefined

      const rpcServer = createRpcServer(agent, { socketPath })

      await rpcServer.start()

      // 输出连接信息到 stderr（不污染标准输出）
      process.stderr.write(`RPC 服务已启动，监听：${rpcServer.socketPath}\n`)
      logger.info('RPC mode started, socket: %s', rpcServer.socketPath)

      // 长驻运行：等待终止信号
      await new Promise<void>((resolve) => {
        const shutdown = (): void => {
          logger.info('Received shutdown signal, stopping RPC server')
          resolve()
        }
        process.on('SIGINT', shutdown)
        process.on('SIGTERM', shutdown)
      })

      // 清理
      await rpcServer.stop()
      logger.info('RPC server stopped')
    },
  }
}
