import { expect, test, type Page } from '@playwright/test'
import { requireTestCredentials } from './support/credentials'
import { skipNicknamePrompt } from './support/nicknamePrompt'

/**
 * The contract board on the refuge and the collections, against the
 * development project.
 *
 * Opt-in like every browser suite: it needs the test account and a Supabase
 * project with the contracts migrations applied. It reads what the server
 * deals rather than asserting a particular contract, because the board is
 * rolled per account and per day.
 */

test.describe.configure({ mode: 'serial' })

async function signIn(page: Page): Promise<void> {
  const { email, password } = requireTestCredentials('authenticated contract flows')

  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByLabel('Keep me signed in on this browser').check()
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
  await skipNicknamePrompt(page)
}

test('pins three daily contracts and one weekly on the refuge, each with a bar and its pay', async ({ page }) => {
  await page.goto('/')
  await signIn(page)

  const board = page.getByRole('region', { name: 'Contracts' })
  await expect(board).toBeVisible({ timeout: 15_000 })
  await expect(board.getByText(/claimed today/)).toBeVisible({ timeout: 15_000 })

  const daily = board.getByRole('list', { name: 'Daily contracts' })
  const dailyRows = daily.locator('.hub-contract')
  await expect(dailyRows).toHaveCount(3)
  const weekly = board.getByRole('list', { name: 'Weekly contract' })
  await expect(weekly.locator('.hub-contract')).toHaveCount(1)

  for (let index = 0; index < 3; index += 1) {
    const row = dailyRows.nth(index)
    await expect(row.getByRole('progressbar')).toBeVisible()
    await expect(row.getByRole('list', { name: 'Reward' }).getByRole('listitem').first()).toBeVisible()
  }

  // The board is dealt once: a reload shows the same three contracts.
  const names = await dailyRows.locator('strong').allTextContents()
  await page.reload()
  await expect(page.getByRole('region', { name: 'Contracts' }).getByText(/claimed today/)).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('list', { name: 'Daily contracts' }).locator('.hub-contract strong')).toHaveText(names)
})

test('lists every collection page with its milestones', async ({ page }) => {
  await page.goto('/collections')
  await signIn(page)

  await expect(page.getByRole('heading', { name: 'Collections', exact: true })).toBeVisible()
  for (const [name, count] of [['Fish', 10], ['Artifacts', 5], ['Champions', 8]] as const) {
    const region = page.getByRole('region', { name })
    await expect(region).toBeVisible({ timeout: 15_000 })
    await expect(region.getByRole('list', { name: `${name} entries` }).getByRole('listitem')).toHaveCount(count)
    await expect(region.getByRole('list', { name: `${name} milestones` }).getByRole('listitem')).toHaveCount(3)
  }
})

test('reaches the collections from the refuge', async ({ page }) => {
  await page.goto('/')
  await signIn(page)

  await page.getByRole('button', { name: 'Collections' }).first().click()
  await expect(page).toHaveURL(/\/collections$/)
  await expect(page.getByRole('heading', { name: 'Collections', exact: true })).toBeVisible()
})
