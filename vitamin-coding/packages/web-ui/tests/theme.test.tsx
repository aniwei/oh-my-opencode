import { MantineProvider } from '@mantine/core'
import { renderToString } from 'react-dom/server'
import { theme } from '../src/theme'

describe('web-ui theme', () => {
  describe('#given MantineProvider + theme', () => {
    describe('#when 执行 SSR renderToString', () => {
      it('#then 可正常渲染且包含内容', () => {
        const html = renderToString(
          <MantineProvider defaultColorScheme="dark" theme={theme}>
            <div>vitamin-web-ui-theme-ok</div>
          </MantineProvider>,
        )

        expect(html).toContain('vitamin-web-ui-theme-ok')
      })
    })
  })
})
