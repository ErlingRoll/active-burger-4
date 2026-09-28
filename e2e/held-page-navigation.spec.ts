import { expect, test } from '@playwright/test'
import { requireTestCredentials } from './support/credentials'
import { skipNicknamePrompt } from './support/nicknamePrompt'

/**
 * Held-page navigation, seen from the browser.
 *
 * The inventory's chunk is held at the network so the navigation is caught in
 * flight: the refuge must still be on screen, the shell must say a navigation
 * is pending, the tile that was pressed must be busy, and no loading panel
 * may appear. Releasing the chunk lets the inventory paint, at which point the
 * shell settles. See docs/decisions/0013-held-page-navigation.md.
 */
test('holds the refuge until the inventory can paint', async ({ page }) => {
  const { email, password } = requireTestCredentials('held-page navigation')

  let releaseChunk: () => void = () => {}
  const chunkHeld = new Promise<void>((resolve) => {
    releaseChunk = resolve
  })
  await page.route(/\/src\/loot\/LootBoxScreen\.tsx/, async (route) => {
    await chunkHeld
    await route.continue()
  })

  await page.goto('/')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
  await skipNicknamePrompt(page)

  const inventoryTile = page
    .getByRole('navigation', { name: 'Elsewhere in the refuge' })
    .getByRole('button', { name: 'Inventory' })
  await expect(inventoryTile).toBeEnabled()

  await inventoryTile.click()

  const shell = page.locator('.app-shell')
  await expect(shell).toHaveAttribute('data-navigation', 'pending')
  await expect(inventoryTile).toHaveAttribute('aria-busy', 'true')
  await expect(page.getByText('The inventory is loading…')).toHaveCount(0)

  releaseChunk()

  await expect(page.locator('#inventory-title')).toBeVisible()
  await expect(shell).toHaveAttribute('data-navigation', 'settled')
  await expect(page).toHaveURL(/\/inventory$/)
})
