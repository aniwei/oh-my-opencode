import { Text } from 'ink'
import { theme } from '../theme.js'

interface LinkProps {
  url: string
  label?: string
}

/**
 * Terminal hyperlink — uses OSC 8 escape sequence via Ink's Text component.
 * Falls back to displaying the URL directly if terminal doesn't support links.
 */
export function Link({ url, label }: LinkProps) {
  return (
    <Text color={theme.markdownLink}>
      {`\u001B]8;;${url}\u0007${label ?? url}\u001B]8;;\u0007`}
    </Text>
  )
}
