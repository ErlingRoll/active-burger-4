import { expect, test } from '@playwright/test'

test('renders the prototype arena canvas', async ({ page }) => {
  await page.goto('/')

  await expect(
    page.getByRole('img', { name: 'Active Burger 4 game arena' }),
  ).toBeVisible()
  await expect(page.locator('.game-canvas canvas')).toHaveCount(1)
})
