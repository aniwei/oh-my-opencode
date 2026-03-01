> [← 返回目录](README.md)

## 第六部分：工程基建与开发规范

### 6.1 pnpm workspace 配置

```yaml
# pnpm-workspace.yaml
packages:
  - "packages/*"
  - "extensions/*"
```

```json
// 根 package.json
{
  "name": "vitamin-coding-agent",
  "private": true,
  "type": "module",
  "engines": { "node": ">=22.0.0" },
  "packageManager": "pnpm@9.15.0",
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev --parallel",
    "test": "vitest",
    "test:ci": "vitest run --reporter=verbose",
    "typecheck": "turbo run typecheck",
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "clean": "turbo run clean && rm -rf node_modules",
    "release": "changeset publish"
  },
  "devDependencies": {
    "@biomejs/biome": "^2.0.0",
    "@changesets/cli": "^2.27.0",
    "turbo": "^2.3.0",
    "typescript": "^5.7.0",
    "vitest": "^3.0.0",
    "tsup": "^8.3.0"
  }
}
```

### 6.2 Turborepo 配置

```json
// turbo.json
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["tsconfig.base.json"],
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "test": {
      "dependsOn": ["build"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    },
    "clean": {
      "cache": false
    }
  }
}
```

### 6.3 子包构建配置（tsup）

```typescript
// packages/ai/tsup.config.ts
import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: true,
  clean: true,
  sourcemap: true,
  target: "node22",
  splitting: false,
  treeshake: true,
  external: ["@vitamin/*"],
})
```

### 6.4 TypeScript 基础配置

```json
// tsconfig.base.json
{
  "compilerOptions": {
    "target": "ES2024",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2024"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "rootDir": "src",
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

### 6.5 测试策略

```typescript
// vitest.workspace.ts
import { defineWorkspace } from "vitest/config"

export default defineWorkspace([
  "packages/*/vitest.config.ts",
  "extensions/*/vitest.config.ts",
])
```

| 类型 | 工具 | 范围 | 注意 |
|------|------|------|------|
| 单元测试 | vitest | 每个包内 co-located `*.test.ts` | given/when/then 嵌套 describe |
| 集成测试 | vitest | `packages/coding-agent/tests/` | 跨包集成 |
| E2E 测试 | 自定义 | `tests/e2e/` | 真实 LLM 调用（CI 中 mock） |
| 性能测试 | vitest bench | `benchmarks/` | Agent 循环吞吐量 |

### 6.6 开发规范

> 完整编码规范详见 [CONVENTIONS.md](../CONVENTIONS.md)

| 规范 | 说明 |
|------|------|
| 文件命名 | kebab-case（`agent-loop.ts`、`model-resolver.ts`） |
| 导出 | 每个包一个 `index.ts` 桶导出 |
| 工厂模式 | 所有系统组件使用 `createXxx()` 工厂函数 |
| 错误处理 | 永远不用空 `catch(e) {}`；自定义错误类型 |
| 类型安全 | 严格模式；禁用 `as any` / `@ts-ignore` / `@ts-expect-error` |
| 注释 | 中文 `//` 行注释；禁止 JSDoc 块注释；禁止 AI 生成模式注释 |
| 模块引入 | 相对路径不加 `.js` 后缀（`moduleResolution: bundler`） |
| 测试位置 | `packages/<name>/tests/` 独立目录，不与源码混放 |
| 日志 | 所有运行时模块使用 `@vitamin/shared` 的 pino 日志 |
| 代码量 | 单文件 200 LOC 软上限；禁止 catch-all 文件（`utils.ts`） |

### 6.7 CI/CD

```yaml
# .github/workflows/ci.yml
name: CI
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint
      - run: pnpm typecheck
      - run: pnpm test:ci
      - run: pnpm build
```
