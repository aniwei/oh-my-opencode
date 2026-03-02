# Part 13：Model Provider 对标 OpenCode 设计

> 版本：v0.1 | 日期：2026-03-02  
> 目标：参考 `anomalyco/opencode` 的 Provider 体系，实现可扩展的多提供商接入方案（首批聚焦 GitHub Copilot）

---

## 1. 设计目标

1. 对齐 OpenCode 的「Provider 聚合 + 配置覆盖 + 认证分离」思路。  
2. 保持 `@vitamin/ai` 现有 `ProviderAdapter` 抽象不破坏，增量扩展。  
3. 首批交付 GitHub Copilot 稳定接入路径，并为后续 OAuth Provider 复用。

规范落点：本设计对应 [DEVELOPMENT-SPEC.md §S3.7-S3.9](DEVELOPMENT-SPEC.md#s37-provider-runtime-view三层合并模型)。

---

## 2. OpenCode 参考实现（抽象）

基于 `anomalyco/opencode` 的 provider 模块与文档，可抽象出以下关键模式：

### 2.1 Provider 状态聚合

- Provider 清单来源不是单一源，而是多源合并：
  - 预置 provider/model 数据（模型目录）
  - 项目配置中的 provider 覆盖
  - 本地认证状态（已连接 provider）
- 合并后再进行启停过滤（enabled/disabled），并输出最终可用 provider 列表。

### 2.2 认证与配置分离

- `/connect` 仅负责保存凭据，不直接改写 provider 业务配置。
- provider 行为配置（`baseURL`、`headers`、`models` 等）通过配置文件管理。
- 该模式可避免“凭据污染项目配置”和“配置变更触发凭据失效”耦合。

### 2.3 Copilot 专项处理

- Copilot 支持 OAuth Device Flow（含轮询与超时控制）。
- Copilot 需要请求头注入与 API 适配逻辑（不同模型/接口策略）。
- 企业场景可扩展为 `github-copilot-enterprise` 分支而不破坏主 provider。

### 2.4 模型选择与容错

- 默认模型选择优先级：显式配置 > 最近使用 > provider 默认排序。
- provider/model 不存在时返回候选建议（fuzzy suggestions），提高可诊断性。

---

## 3. vitamin-coding 目标架构

### 3.1 Provider Source 三层模型

在 `@vitamin/ai` 内引入统一视图（只在内部实现，不强制对外暴露新 API）：

1. **Catalog Layer**：静态模型清单（当前 `model-registry.ts`）。
2. **Config Layer**：用户配置覆盖（`provider.*.options/models/headers`）。
3. **Auth Layer**：凭据状态（env / token / OAuth session）。

合并算法：`catalog <- config <- auth-runtime-patch`。

### 3.2 Auth 与 Config 职责边界

- `install` / `doctor` 只处理凭据可用性与连通性检查。
- provider 细粒度行为（`baseURL`、路由策略、header 覆盖）仅通过配置管理。
- `api-key-resolver.ts` 扩展为「多来源凭据解析器」，保持 env 优先级最高。

### 3.3 Copilot Provider 统一规范

`providers/github-copilot.ts` 统一遵循：

- providerId：`github-copilot`
- api type：`github-copilot`
- 默认 baseURL：`https://api.githubcopilot.com`
- 鉴权来源优先级：`GITHUB_TOKEN` > 配置 token > OAuth 会话（后续）
- 与 `openai-responses` / `openai-completions` 的路由决策保持可测试（按 model 前缀与能力）

### 3.4 错误模型与可观测性

- provider 初始化失败统一抛 `ProviderError` 子类，并带 `providerId/modelId`。
- model/provider 不存在时返回候选建议（最少 3 条）。
- 对 Copilot 增加认证失效提示语义（401/403 映射为“需重新认证”）。

---

## 4. 数据结构与接口增量

## 4.1 Provider Runtime View（内部）

```ts
type ProviderRuntimeInfo = {
  id: string
  name: string
  source: 'catalog' | 'config' | 'auth'
  env: string[]
  options: Record<string, unknown>
  models: Record<string, ModelInfo>
}
```

### 4.2 Resolver 扩展点

- `api-key-resolver.ts`
  - `resolveProviderCredential(providerId, modelId?)`
  - 统一返回 `{ token, source }`
- `model-resolver.ts`
  - 增加 `resolveDefaultModel(preferences)` 的“最近使用优先”插槽（后续可选）

---

## 5. 分阶段落地

### Phase A（本轮）

1. 固化 Copilot provider 接入路径（安装、诊断、占位模型路由）。
2. 定义并落地本设计文档与开发计划任务。

### Phase B

1. 引入 Provider Runtime View 合并逻辑（catalog/config/auth）。
2. provider/model 候选建议错误。
3. Copilot 认证失效语义化错误映射。

### Phase C

1. OAuth Device Flow 抽象，支持 Copilot/其他 OAuth Provider 复用。
2. provider 级路由策略（order/only）可配置化（兼容 OpenCode 语义）。

---

## 6. 验收标准（专项）

1. `github-copilot/...` 模型在 `coding-agent` 与 `sdk` 中均能正确推导 provider transport。  
2. `install` 提供 Copilot 入口，`doctor` 提供 Copilot 健康检查。  
3. 认证缺失与认证失败错误信息可区分。  
4. 文档与开发计划形成双向链接（本文件 ↔ DEVELOPMENT-PLAN）。

---

## 7. 风险与边界

- 不在本轮引入全量 OAuth 存储层改造，仅保留扩展位。  
- 不在本轮改动所有 provider，仅以 Copilot 为基准样例。  
- 不引入 breaking API；现有 `ProviderAdapter` 与外部调用保持兼容。
