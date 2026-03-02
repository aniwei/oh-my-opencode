import { useCallback, useEffect, useRef, useState } from 'react'
import { Paper } from '@mantine/core'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import remarkMath from 'remark-math'
import rehypeKatex from 'rehype-katex'
import { CodeBlock } from './code-block'
import { isMermaidBlock, extractLanguage, cleanCodeContent } from '../../utils/markdown-plugins'

function MermaidBlock(props: { code: string }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [svg, setSvg] = useState<string>('')
  const [error, setError] = useState<string>('')

  useEffect(() => {
    let cancelled = false

    async function render() {
      try {
        const mermaid = await import('mermaid')
        mermaid.default.initialize({ startOnLoad: false, theme: 'dark' })
        const id = `mermaid-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
        const { svg: result } = await mermaid.default.render(id, props.code)
        if (!cancelled) {
          setSvg(result)
        }
      } catch (err) {
        if (!cancelled) {
          setError(String(err))
        }
      }
    }

    void render()
    return () => { cancelled = true }
  }, [props.code])

  if (error) {
    return (
      <Paper p="sm" radius="md" withBorder>
        <CodeBlock language="text" code={props.code} />
      </Paper>
    )
  }

  return (
    <Paper p="sm" radius="md" withBorder>
      <div ref={containerRef} dangerouslySetInnerHTML={{ __html: svg }} />
    </Paper>
  )
}

interface MarkdownRendererProps {
  content: string
}

export function MarkdownRenderer(props: MarkdownRendererProps) {
  const renderCode = useCallback((nodeProps: any) => {
    const className = nodeProps.className ?? ''
    const language = extractLanguage(className)

    if (!nodeProps.inline) {
      const code = cleanCodeContent(String(nodeProps.children))

      if (isMermaidBlock(language)) {
        return <MermaidBlock code={code} />
      }

      return (
        <Paper p="sm" radius="md" withBorder>
          <CodeBlock language={language} code={code} />
        </Paper>
      )
    }

    return <code>{nodeProps.children}</code>
  }, [])

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkMath]}
      rehypePlugins={[rehypeKatex]}
      components={{
        code: renderCode,
      }}
    >
      {props.content}
    </ReactMarkdown>
  )
}
