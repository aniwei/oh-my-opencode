# Part 16：Packages 依赖稳定性审计与替换建议

> 版本：v0.1 | 日期：2026-03-09
> 目标：检查 `vitamin-coding/packages` 现有能力（JSONC / LLM AI / SDK RPC / MCP 等），优先采用社区成熟稳定包

---

## 1. 本轮已落地替换

1. JSONC + 安全序列化（`@vitamin/shared`）
- 现状变更：
  - `parseJsonc()` 改为 `jsonc-parser`
  - `safeStringify()` 改为 `safe-stable-stringify`
- 代码位置：
  - `vitamin-coding/packages/shared/src/json.ts`
  - `vitamin-coding/packages/shared/package.json`

2. SSE 事件流解析（`@vitamin/ai`）
- 现状变更：
  - `httpStreamRequest()` 改为 `eventsource-parser` 驱动
  - 删除手写 SSE 分帧解析逻辑
- 代码位置：
  - `vitamin-coding/packages/ai/src/utils/http-client.ts`
  - `vitamin-coding/packages/ai/package.json`

3. 质量守卫自动化（类型安全）
- 现状变更：
  - 新增 `scripts/check-type-safety-guards.ts`
  - CI 强制检查 `as any` / `@ts-ignore` / `@ts-expect-error` / 空 catch
  - `unknown as` 先纳入债务指标统计（可通过 `--strict-unknown-as` 进入强约束）
- 代码位置：
  - `vitamin-coding/scripts/check-type-safety-guards.ts`
  - `vitamin-coding/.github/workflows/ci.yml`

---

## 2. packages 级成熟度结论

| 包 | 现状 | 结论 |
|---|---|---|
| `@vitamin/shared` | `pino`，JSON 工具已迁移成熟库 | 稳定 |
| `@vitamin/config` | `zod` + 内部 JSONC 容错恢复 | 基础稳定，可继续优化恢复策略 |
| `@vitamin/ai` | Provider 适配层大量手写 HTTP 协议转换 | 架构正确，但建议逐步接入官方 SDK |
| `@vitamin/mcp` | 传输层与 JSON-RPC 处理为手写实现 | 建议优先迁移到 MCP 官方 SDK 内核 |
| `@vitamin/sdk` | JSON-RPC over socket 手写实现 | 可用，建议引入成熟 JSON-RPC 框架降低协议风险 |
| `@vitamin/coding-agent` | 终端交互依赖 Ink 生态，较成熟 | 稳定 |
| `@vitamin/server/web-ui/ui-kit` | React/Mantine/Vite 生态成熟 | 稳定 |

---

## 3. 高优先级替换（建议按顺序）

### P0：MCP 传输内核标准化

建议：以 `@modelcontextprotocol/sdk` 作为 `@vitamin/mcp` 的底层实现，保留当前 `McpTransport`/`McpRegistry` 外部抽象。

证据位置：
- `vitamin-coding/packages/mcp/src/transports/stdio.ts`
- `vitamin-coding/packages/mcp/src/transports/http.ts`
- `vitamin-coding/packages/mcp/src/transports/sse.ts`

收益：
1. 降低协议细节与兼容性维护成本
2. 提升与 MCP 规范迭代同步效率
3. 减少手写 JSON-RPC/SSE 边界 bug

### P1：AI Provider 分层引入官方 SDK

当前问题：多个 provider 仍是“手写请求体 + 手写事件解析”。

证据位置：
- `vitamin-coding/packages/ai/src/providers/anthropic-messages.ts`
- `vitamin-coding/packages/ai/src/providers/openai-responses.ts`
- `vitamin-coding/packages/ai/src/providers/google-generative-ai.ts`
- `vitamin-coding/packages/ai/src/providers/bedrock-converse.ts`

建议方案：
1. 保持 `ProviderAdapter` 不变（对上层透明）
2. Provider 内核替换为官方 SDK
3. 保留 `StreamEvent` 统一输出作为跨 provider 契约

建议优先顺序：
1. Bedrock（当前文件已有“应使用 AWS SDK”注释）
2. Anthropic
3. OpenAI Responses
4. Google

### P1：SDK RPC 协议层增强

当前问题：`@vitamin/sdk` 与 `@vitamin/coding-agent` 都维护手写 JSON-RPC 处理。

证据位置：
- `vitamin-coding/packages/sdk/src/rpc-server.ts`
- `vitamin-coding/packages/sdk/src/rpc-client.ts`
- `vitamin-coding/packages/coding-agent/src/modes/rpc/rpc-server.ts`

建议：
- 评估 `vscode-jsonrpc` 或 `json-rpc-2.0`，统一 framing、错误码、批量请求、通知机制。

---

## 4. 中优先级优化

1. `@vitamin/config` 的部分恢复解析
- 当前 `parseKeyByKey` 基于行模式恢复，容错强但语义复杂。
- 可继续利用 `jsonc-parser` 的 AST/offset 能力提升恢复精度。

2. HTTP resiliency
- 评估 `p-retry` + `p-timeout` + `bottleneck`（限流）组合，减少 provider 抖动影响。

---

## 5. 替换原则（避免“为了替换而替换”）

1. 保留 vitamin 的领域抽象
- `@vitamin/ai`：`Model/StreamEvent/ProviderAdapter`
- `@vitamin/mcp`：`McpTransport/McpRegistry`
- `@vitamin/sdk`：`VitaminAgent` 与流式事件接口

2. 只替换底层实现，不破坏上层 API
- 先适配器，后替换内核

3. 每次替换附带契约测试
- 重点覆盖：流式事件顺序、工具调用、错误与超时、跨 provider 一致性

---

## 6. 建议执行路线

1. Phase A（已做）
- JSONC、SSE 两项底层基础能力替换

2. Phase B（下一个迭代）
- MCP SDK 内核替换（保持外部接口不变）
- Bedrock provider 切 AWS SDK

3. Phase C
- OpenAI/Anthropic/Google provider 内核 SDK 化
- SDK RPC 协议框架统一
