import { expect, test, type Page } from '@playwright/test'
import { requireTestCredentials } from './support/credentials'
import { skipNicknamePrompt } from './support/nicknamePrompt'

/**
 * The contract board and the collections, against the development project.
 *
 * Opt-in like every browser suite: it needs the test account and a Supabase
 * project with the contracts migration applied. It reads what the server
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

test('deals three daily contracts and one weekly, each with a reward and a countdown', async ({ page }) => {
  await page.goto('/contracts')
  await signIn(page)

  await expect(page.getByRole('heading', { name: 'Contracts', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('heading', { name: 'This week' })).toBeVisible()

  const daily = page.getByRole('region', { name: 'Today' })
  const dailyCards = daily.locator('.contract-card')
  await expect(dailyCards).toHaveCount(3)
  const weekly = page.getByRole('region', { name: 'This week' })
  await expect(weekly.locator('.contract-card')).toHaveCount(1)

  for (let index = 0; index < 3; index += 1) {
    const card = dailyCards.nth(index)
    await expect(card.getByRole('progressbar')).toBeVisible()
    await expect(card.getByRole('list', { name: 'Reward' }).getByRole('listitem').first()).toBeVisible()
    await expect(card.getByRole('button', { name: /Claim|In progress|Claimed/ })).toBeVisible()
  }
  await expect(daily.getByText(/left|Ending now|Claimed/).first()).toBeVisible()

  // The board is dealt once: a reload shows the same three contracts.
  const names = await dailyCards.locator('h4').allTextContents()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible({ timeout: 15_000 })
  await expect(page.getByRole('region', { name: 'Today' }).locator('.contract-card h4')).toHaveText(names)
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

test('reaches the board and the cases from the refuge', async ({ page }) => {
  await page.goto('/')
  await signIn(page)

  await page.getByRole('button', { name: 'Contracts' }).first().click()
  await expect(page).toHaveURL(/\/contracts$/)
  await expect(page.getByRole('heading', { name: 'Contracts', exact: true })).toBeVisible()

  await page.getByRole('button', { name: /Back to the refuge/ }).click()
  await page.getByRole('button', { name: 'Collections' }).first().click()
  await expect(page).toHaveURL(/\/collections$/)
  await expect(page.getByRole('heading', { name: 'Collections', exact: true })).toBeVisible()
})
