// SDK 类型导出测试（验收 4.3.6）
import {
  createVitaminAgent,
  createAgentStream,
  AgentStreamImpl,
  createRpcServer,
  createRpcClient,
} from '../src/index'

import type {
  VitaminAgent,
  VitaminAgentOptions,
  VitaminAgentState,
  StreamEvent,
  AgentStream,
  RPCRequest,
  RPCResponse,
  RPCError,
  RPCServerOptions,
  RPCClientOptions,
  RPCServerHandle,
  RPCClientHandle,
} from '../src/index'

describe('SDK 导出完整性', () => {
  // 验收 4.3.6: npm 可发布（类型声明完整）
  describe('#given index 导出', () => {
    describe('#when 检查函数导出', () => {
      it('#then createVitaminAgent 存在且为函数', () => {
        expect(typeof createVitaminAgent).toBe('function')
      })

      it('#then createAgentStream 存在且为函数', () => {
        expect(typeof createAgentStream).toBe('function')
      })

      it('#then AgentStreamImpl 存在且为构造函数', () => {
        expect(typeof AgentStreamImpl).toBe('function')
      })

      it('#then createRpcServer 存在且为函数', () => {
        expect(typeof createRpcServer).toBe('function')
      })

      it('#then createRpcClient 存在且为函数', () => {
        expect(typeof createRpcClient).toBe('function')
      })
    })

    describe('#when 检查类型导出（编译时验证）', () => {
      it('#then VitaminAgentOptions 类型可用', () => {
        // 类型系统验证 — 编译通过即成功
        const _options: VitaminAgentOptions = {
          projectDir: '/tmp/test',
        }
        expect(_options.projectDir).toBe('/tmp/test')
      })

      it('#then StreamEvent 联合类型包含 start/text_delta/done/error', () => {
        const events: StreamEvent[] = [
          { type: 'start' },
          { type: 'text_delta', text: 'hello' },
          { type: 'tool_call', name: 'test', args: {} },
          { type: 'tool_result', name: 'test', result: 'ok' },
          { type: 'done', result: { response: '', cost: 0, tokens: { input: 0, output: 0 }, toolCalls: [], duration: 0 } },
          { type: 'error', error: 'bad' },
        ]
        expect(events).toHaveLength(6)
      })

      it('#then RPCRequest/RPCResponse 类型可用', () => {
        const request: RPCRequest = { jsonrpc: '2.0', id: 1, method: 'prompt' }
        const response: RPCResponse = { jsonrpc: '2.0', id: 1, result: {} }
        const error: RPCError = { code: -32600, message: 'Invalid' }

        expect(request.jsonrpc).toBe('2.0')
        expect(response.jsonrpc).toBe('2.0')
        expect(error.code).toBe(-32600)
      })
    })
  })
})
