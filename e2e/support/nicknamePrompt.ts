import { expect, type Page } from '@playwright/test'

/**
 * Skips the nickname prompt a new account meets right after signing in.
 *
 * The app marks its shell with `data-nickname-prompt` so a suite can tell a
 * prompt that is still to come from one that will not come: the attribute
 * reads "loading" until the nickname has been fetched, then "open" or
 * "closed". Waiting on it keeps the sign-in helpers deterministic whatever
 * state the test account is in.
 */
export async function skipNicknamePrompt(page: Page): Promise<void> {
  const shell = page.locator('.app-shell')
  await expect(shell).toHaveAttribute('data-nickname-prompt', /open|closed/, {
    timeout: 20_000,
  })
  if (await shell.getAttribute('data-nickname-prompt') === 'open') {
    await page.getByRole('button', { name: 'Skip for now' }).click()
    await expect(shell).toHaveAttribute('data-nickname-prompt', 'closed')
  }
}
