import { ActionIcon, Code, CopyButton, Group, Stack, Tooltip } from '@mantine/core'
import { useEffect, useState } from 'react'
import type { Highlighter } from 'shiki'

let highlighterPromise: Promise<Highlighter> | null = null

async function getHighlighter(): Promise<Highlighter> {
  if (!highlighterPromise) {
    highlighterPromise = import('shiki').then((module) =>
      module.createHighlighter({
        themes: ['one-dark-pro', 'github-light'],
        langs: [
          'typescript', 'javascript', 'tsx', 'jsx', 'json', 'html', 'css',
          'python', 'rust', 'go', 'bash', 'shell', 'markdown', 'yaml', 'toml',
          'sql', 'dockerfile', 'diff', 'plaintext',
        ],
      }),
    )
  }

  return highlighterPromise
}

interface CodeBlockProps {
  language: string
  code: string
}

export function CodeBlock(props: CodeBlockProps) {
  const [html, setHtml] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    void getHighlighter().then((highlighter) => {
      if (cancelled) {
        return
      }

      const loadedLangs = highlighter.getLoadedLanguages()
      const lang = loadedLangs.includes(props.language) ? props.language : 'plaintext'

      const highlighted = highlighter.codeToHtml(props.code, {
        lang,
        themes: { dark: 'one-dark-pro', light: 'github-light' },
      })

      setHtml(highlighted)
    })

    return () => {
      cancelled = true
    }
  }, [props.code, props.language])

  return (
    <Stack gap={4}>
      <Group justify="space-between">
        <Code>{props.language || 'text'}</Code>
        <CopyButton value={props.code}>
          {({ copied, copy }) => (
            <Tooltip label={copied ? 'Copied' : 'Copy code'} withArrow>
              <ActionIcon aria-label="Copy code" variant="subtle" size="sm" onClick={copy}>
                {copied ? '✓' : '⧉'}
              </ActionIcon>
            </Tooltip>
          )}
        </CopyButton>
      </Group>
      {html ? (
        <div
          style={{ overflowX: 'auto', borderRadius: 8, fontSize: '0.85em', lineHeight: 1.6 }}
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <pre style={{ margin: 0, overflowX: 'auto', padding: 12, borderRadius: 8, background: 'var(--mantine-color-body)' }}>
          <code>{props.code}</code>
        </pre>
      )}
    </Stack>
  )
}
