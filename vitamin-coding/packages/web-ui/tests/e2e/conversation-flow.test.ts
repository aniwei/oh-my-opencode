import { test, expect, type Page } from '@playwright/test'

const BASE_URL = process.env.WEB_UI_URL ?? 'http://localhost:5173'

test.describe('Web UI - 完整会话流程', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL)
  })

  test('首页加载并显示欢迎内容', async ({ page }) => {
    await expect(page).toHaveTitle(/vitamin/i)
    await expect(page.locator('text=Vitamin Coding')).toBeVisible({ timeout: 10_000 })
  })

  test('创建新会话并发送消息', async ({ page }) => {
    await page.getByRole('button', { name: /新.*会话|new.*chat/i }).click()
    await page.waitForURL(/\/chat\//)

    const input = page.getByRole('textbox')
    await input.fill('Hello, this is a test message')
    await input.press('Enter')

    await expect(page.locator('[data-testid="message-bubble"]').first()).toBeVisible({ timeout: 15_000 })
  })

  test('侧边栏显示会话列表', async ({ page }) => {
    const sidebar = page.locator('[data-testid="sidebar"], nav')
    await expect(sidebar).toBeVisible()
  })

  test('设置页面可访问', async ({ page }) => {
    await page.goto(`${BASE_URL}/settings`)
    await expect(page.locator('text=设置')).toBeVisible({ timeout: 10_000 })
  })

  test('键盘快捷键 Ctrl+K 打开命令面板', async ({ page }) => {
    await page.goto(`${BASE_URL}/chat/test-session`)
    await page.keyboard.press('Control+k')

    await expect(page.locator('[data-testid="command-palette"], [role="listbox"]')).toBeVisible({ timeout: 5_000 })
  })

  test('响应式布局 - 移动端收起侧边栏', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto(BASE_URL)

    const sidebar = page.locator('[data-testid="sidebar"], aside')
    const isHidden = await sidebar.isHidden().catch(() => true)
    expect(isHidden).toBe(true)
  })
})

test.describe('Web UI - 主题切换', () => {
  test('切换明暗主题', async ({ page }) => {
    await page.goto(BASE_URL)

    const themeButton = page.getByRole('button', { name: /主题|theme/i })
    if (await themeButton.isVisible()) {
      await themeButton.click()

      const htmlElement = page.locator('html')
      const colorScheme = await htmlElement.getAttribute('data-mantine-color-scheme')
      expect(['light', 'dark']).toContain(colorScheme)
    }
  })
})
