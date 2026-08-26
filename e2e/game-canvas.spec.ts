import { expect, test } from '@playwright/test'

test('renders the prototype arena canvas', async ({ page }) => {
  await page.goto('/')

  await expect(
    page.getByRole('img', { name: 'Active Burger 4 game arena' }),
  ).toBeVisible()
  const canvas = page.locator('.game-canvas canvas')
  await expect(canvas).toHaveCount(1)
  await expect(canvas).toBeVisible()
})
