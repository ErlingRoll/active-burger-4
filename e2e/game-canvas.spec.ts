import { expect, test } from '@playwright/test'

test('shows the pre-run dashboard without mounting the arena', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: /ready for your next run/i })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Start Run' })).toBeVisible()
  await expect(page.locator('.game-canvas')).toHaveCount(0)
})

test('runs the complete dashboard, gameplay, defeat, and return flow', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start Run' }).click()

  await expect(
    page.getByRole('img', { name: 'Active Burger 4 game arena' }),
  ).toBeVisible()
  await expect(page.locator('.game-canvas canvas')).toHaveCount(1)
  await expect(page.getByRole('heading', { name: 'Run status' })).toBeAttached()
  await expect(page.getByRole('button', { name: 'End Run' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Development Menu' }).click()
  const developmentMenu = page.getByRole('heading', {
    name: 'Development Menu',
  }).locator('..')
  await expect(developmentMenu).toBeVisible()

  const speedInput = page.getByRole('spinbutton', {
    name: 'Simulation speed',
  })
  await expect(speedInput).toHaveValue('1')
  await speedInput.fill('2.5')
  await expect(speedInput).toHaveValue('2.5')
  await expect(developmentMenu.getByText('Applied: 2.5x')).toBeVisible()

  await speedInput.fill('11')
  await expect(speedInput).toHaveValue('11')
  await expect(
    developmentMenu.getByRole('alert'),
  ).toContainText('between 0.1x and 10x')

  await developmentMenu.getByRole('button', { name: 'End Run' }).click()
  await expect(page.getByRole('heading', { name: 'Defeat' })).toBeVisible()
  await expect(page.getByText('Elapsed time')).toBeVisible()
  await expect(page.getByText('Level')).toBeVisible()
  await expect(page.getByText('XP')).toBeVisible()
  await expect(page.getByText('Kills')).toBeVisible()
  await expect(page.locator('.game-canvas')).toHaveCount(0)

  await page.getByRole('button', { name: 'Return to Dashboard' }).click()
  await expect(
    page.getByRole('heading', { name: /ready for your next run/i }),
  ).toBeVisible()
  await expect(page.locator('.game-canvas')).toHaveCount(0)
})

test('keeps the arena running after endless combat begins', async ({ page }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start Run' }).click()
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
  await expect(page.getByRole('button', { name: 'Start Run' })).toBeVisible()
  await page.getByRole('button', { name: 'Start Run' }).click()

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
