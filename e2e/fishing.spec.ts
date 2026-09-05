import { expect, test, type Page } from '@playwright/test'
import { loadEnv } from 'vite'

const testEnvironment = loadEnv('test', process.cwd(), 'VITE_')
const testUserEmail = testEnvironment.VITE_TEST_USER_EMAIL
const testUserPassword = testEnvironment.VITE_TEST_USER_PASSWORD

test.describe.configure({ mode: 'serial' })

async function signInForFishing(
  page: Page,
): Promise<void> {
  test.skip(
    !testUserEmail || !testUserPassword,
    'VITE_TEST_USER_EMAIL and VITE_TEST_USER_PASSWORD are required for authenticated fishing flows.',
  )

  await page.getByLabel('Email').fill(testUserEmail)
  await page.getByLabel('Password').fill(testUserPassword)
  await page.getByLabel('Keep me signed in on this browser').check()
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
}

test('resolves an authenticated manual fishing attempt', async ({ page }) => {
  await page.goto('/fishing')
  await signInForFishing(page)

  await expect(
    page.getByRole('heading', { name: /Fishing · Moonwater Pond/i }),
  ).toBeVisible()
  const fishingInventoryToggle = page.locator('.fishing-inventory-toggle')
  await fishingInventoryToggle.click()
  const fishingInventoryCards = page.locator(
    '#fishing-inventory .inventory-item-card:not(.inventory-item-card-empty)',
  )
  await expect(fishingInventoryCards.first()).toBeVisible()
  for (let index = 0; index < await fishingInventoryCards.count(); index += 1) {
    await fishingInventoryCards.nth(index).hover()
  }
  await expect(page.locator('#fishing-inventory .inventory-item-card-unseen')).toHaveCount(0)
  await page.getByRole('button', { name: 'Close', exact: true }).click()

  const castButton = page.getByRole('button', { name: 'Cast' })
  await expect(castButton).toBeEnabled({ timeout: 15_000 })

  const modeTrigger = page.getByRole('button', { name: 'Auto fish' })
  await modeTrigger.click()
  const modeMenu = page.getByRole('listbox', { name: 'Mode' })
  await expect(modeMenu).toBeVisible()
  const [menuBox, triggerBox] = await Promise.all([
    modeMenu.boundingBox(),
    modeTrigger.boundingBox(),
  ])
  if (!menuBox || !triggerBox) {
    throw new Error('Unable to measure the fishing mode dropdown.')
  }
  expect(menuBox.y + menuBox.height).toBeLessThanOrEqual(triggerBox.y + 1)
  await page.getByRole('option', { name: 'Manual reel' }).click()
  await expect(page.getByRole('button', { name: 'Manual reel' })).toBeVisible()

  await castButton.click()
  const reelButton = page.getByRole('button', { name: 'Reel in' })
  await expect(reelButton).toBeVisible({ timeout: 25_000 })
  await reelButton.click()

  await expect(page.getByText('Catch received', { exact: true })).toBeVisible({
    timeout: 15_000,
  })
  await expect(page.getByText(/Size \d+\.\d+ kg/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Cast' })).toBeEnabled()

  await fishingInventoryToggle.click()
  await expect(page.locator('#fishing-inventory .inventory-item-card-unseen').first()).toBeVisible()
  await page.getByRole('button', { name: 'Close', exact: true }).click()

  await page.goto('/inventory')
  await expect(page.getByRole('heading', { name: 'Inventory', exact: true })).toBeVisible()
  const firstFish = page.getByRole('listitem', { name: /Weight: \d+\.\d+ kg/ }).first()
  await firstFish.click()
  const salvageButton = page.getByRole('button', { name: 'Salvage', exact: true }).first()
  await expect(salvageButton).toBeVisible()
  await salvageButton.click()
  const salvageDialog = page.getByRole('dialog', { name: 'Salvage fish?' })
  await expect(salvageDialog).toBeVisible()
  await salvageDialog.getByRole('button', { name: 'Salvage fish' }).click()
  await expect(page.getByText('Fish salvaged', { exact: true })).toBeVisible()
  await expect(page.getByText(/\+[1-9]\d* Essence/)).toBeVisible()
})
