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

test('keeps the arena running after endless combat begins', async ({ page }) => {
  await page.goto('/')
  const canvas = page.locator('.game-canvas canvas')

  await expect(canvas).toBeVisible()
  // The director's first budgeted spawn occurs after roughly one second.
  await page.waitForTimeout(1_200)
  await expect(canvas).toBeVisible()
})

test('displays the level-up choices and resumes after selecting one', async ({
  page,
}) => {
  await page.goto('/?demo=level-up')

  const overlay = page.getByRole('dialog', { name: /level 2/i })
  await expect(overlay).toBeVisible()
  await expect(overlay.getByRole('button')).toHaveCount(3)

  const firstChoice = overlay.getByRole('button').first()
  await expect(firstChoice).toBeFocused()
  await firstChoice.click()

  await expect(overlay).toBeHidden()
  await expect(page.locator('.game-canvas')).toHaveAttribute(
    'data-game-phase',
    'playing',
  )
})
