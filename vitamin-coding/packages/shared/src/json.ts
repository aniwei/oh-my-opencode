// JSONC 解析（支持注释和尾逗号）以及安全 JSON 序列化

// 解析 JSONC 字符串（带注释的 JSON）
// 支持 // 行注释、/* */ 块注释和尾逗号
export function parseJsonc<T = unknown>(input: string): T {
  const stripped = stripJsonComments(input)
  const cleaned = removeTrailingCommas(stripped)
  return JSON.parse(cleaned) as T
}

// 安全地将值序列化为 JSON，处理循环引用
export function safeStringify(value: unknown, indent?: number): string {
  const seen = new WeakSet()
  return JSON.stringify(
    value,
    (_key, val) => {
      if (typeof val === 'object' && val !== null) {
        if (seen.has(val)) return '[Circular]'
        seen.add(val)
      }
      return val
    },
    indent,
  )
}

// 剥离单行（//）和多行（/* */）注释
function stripJsonComments(input: string): string {
  let result = ''
  let i = 0
  let inString = false
  let escaped = false

  while (i < input.length) {
    const char = input[i] as string
    const next = input[i + 1]

    if (escaped) {
      result += char
      escaped = false
      i++
      continue
    }

    if (inString) {
      if (char === '\\') {
        escaped = true
        result += char
      } else if (char === '"') {
        inString = false
        result += char
      } else {
        result += char
      }
      i++
      continue
    }

    if (char === '"') {
      inString = true
      result += char
      i++
      continue
    }

    if (char === '/' && next === '/') {
      // 行注释 —— 跳过到行尾
      i += 2
      while (i < input.length && input[i] !== '\n') {
        i++
      }
      continue
    }

    if (char === '/' && next === '*') {
      // 块注释 —— 跳过到 */
      i += 2
      while (i < input.length - 1) {
        if (input[i] === '*' && input[i + 1] === '/') {
          i += 2
          break
        }
        i++
      }
      continue
    }

    result += char
    i++
  }

  return result
}

// 去除 } 或 ] 之前的尾逗号
function removeTrailingCommas(input: string): string {
  return input.replace(/,(\s*[}\]])/g, '$1')
}
