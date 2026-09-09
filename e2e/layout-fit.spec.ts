import { mkdir, writeFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { requireTestCredentials } from './support/credentials'
import {
  VIEWPORTS,
  findClippedControls,
  findOverflow,
  formatFindings,
  type OverflowFinding,
} from './support/viewportFit'

/**
 * Every screen, at every viewport in the matrix, measured for overflow and
 * captured as a screenshot.
 *
 * The screenshots land in `test-results/layout-fit/` (gitignored) so a layout
 * change can be looked at as well as asserted on. The assertion is what gates
 * the build: a screen that scrolls — as a page or through an inner container —
 * is a defect, and the message names the element and the axis rather than just
 * failing.
 *
 * The document screens are exempt from the vertical half of that. The codex,
 * the roster and the moderation dashboards each hold more than a viewport by
 * nature, and shrinking them to fit made them unreadable, so they are allowed
 * to scroll down. Sideways is still a defect everywhere: a reader should never
 * have to push a screen left to finish a sentence.
 *
 * One test per viewport rather than one test over the whole matrix, so the
 * viewports run across workers and a failure at one size does not hide the
 * others.
 */

/*
 * Run this with a single worker — `npm run test:layout` does.
 *
 * Every viewport signs in as the same account, and that account's run state
 * lives on the server: in parallel, one worker forfeits the run another is
 * relying on and screens bounce back to the refuge at random. Serial mode
 * would fix the race but stops the suite at the first failure, which is the
 * opposite of what a matrix is for — one bad viewport should not hide the
 * other seven.
 */

const SCREENSHOT_DIRECTORY = 'test-results/layout-fit'

interface ScreenUnderTest {
  readonly name: string
  /** Navigated to directly: routing resolves from the path, so no nav clicking. */
  readonly path: string
  /** Present once the screen has rendered its own content. */
  readonly ready: string
  /** A document rather than a screen: it may scroll down, never sideways. */
  readonly document?: true
}

const SCREENS: readonly ScreenUnderTest[] = [
  { name: 'dashboard', path: '/', ready: '.game-dashboard' },
  { name: 'run-setup', path: '/prepare/dungeon', ready: '.run-setup' },
  { name: 'store', path: '/store', ready: '.meta-progression-screen' },
  { name: 'fishing', path: '/fishing', ready: '.fishing-screen' },
  { name: 'inventory', path: '/inventory', ready: '.inventory-screen' },
  { name: 'champions', path: '/champions', ready: '.champion-management-screen', document: true },
  { name: 'wiki', path: '/wiki', ready: '.wiki-screen', document: true },
]

/**
 * The persisted session is the point: each screen is reached by its own URL,
 * which is a full page load, and an in-memory session would drop the sign-in
 * on the first navigation and leave every screen showing the gateway.
 */
async function signIn(page: Page): Promise<void> {
  const { email, password } = requireTestCredentials('the layout fit matrix')

  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByLabel('Keep me signed in on this browser').check()
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible({
    timeout: 20_000,
  })
}

/**
 * Forfeits a run left over from an earlier session or spec.
 *
 * The Essence store refuses to open while a dungeon run is in progress and
 * sends the player back to the refuge, so without this the store is measured
 * on some runs and silently skipped on others depending on what the shared
 * test account was last used for.
 */
async function clearActiveRun(page: Page): Promise<void> {
  // The hub renders before it knows whether a run is in progress, so without
  // waiting for persistence to settle this looks for a Forfeit button that has
  // not been drawn yet, finds nothing, and leaves the run in place.
  await expect(page.locator('.game-dashboard')).toHaveAttribute(
    'data-run-persistence-state',
    /ready|error|unavailable/,
    { timeout: 20_000 },
  )

  const forfeit = page.getByRole('button', { name: 'Forfeit run' }).last()
  if (await forfeit.count() === 0) {
    return
  }
  await forfeit.click()
  const confirmation = page.getByRole('dialog', { name: 'Forfeit dungeon run?' })
  await confirmation.getByRole('button', { name: 'Forfeit run' }).click()
  await expect(
    page.getByRole('button', { name: /Begin dungeon run|Start a dungeon run/i }),
  ).toBeVisible({ timeout: 20_000 })
}

/**
 * Waits for the things that move layout after first paint. Web fonts change
 * every text metric when they swap in, and the screens play an entry
 * animation, so measuring on the first frame reports the transition rather
 * than the resting layout.
 */
async function settle(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await document.fonts.ready
  })
  await page.waitForTimeout(400)
}

for (const viewport of VIEWPORTS) {
  test.describe(`${viewport.name} (${viewport.width}x${viewport.height})`, () => {
    test.use({ viewport: { width: viewport.width, height: viewport.height } })

    test('every screen fits without scrolling', async ({ page }) => {
      test.setTimeout(180_000)

      await page.goto('/')
      await signIn(page)
      await clearActiveRun(page)

      const failures: string[] = []

      for (const screen of SCREENS) {
        await test.step(screen.name, async () => {
          await page.goto(screen.path)

          const rendered = await page
            .locator(screen.ready)
            .first()
            // The store waits on a network read before it renders anything of
            // its own, so this has to outlast a slow fetch or it reports a
            // layout failure for what is really a loading screen.
            .waitFor({ state: 'visible', timeout: 25_000 })
            .then(() => true)
            .catch(() => false)

          if (!rendered) {
            // Say which state it settled in instead. A screen that is stuck
            // loading and one that rendered an error look identical as a bare
            // selector miss, and they call for opposite fixes.
            const settledOn = await page
              .locator('h1, h2, [role="alert"]')
              .allInnerTexts()
              .catch(() => [])
            failures.push(
              `${screen.name}: never rendered \`${screen.ready}\`` +
                ` (showing: ${settledOn.join(' / ').replace(/\s+/g, ' ').trim() || 'nothing'})`,
            )
            return
          }

          await settle(page)
          await page.screenshot({
            path: `${SCREENSHOT_DIRECTORY}/${viewport.name}--${screen.name}.png`,
          })

          // On a document, everything below the fold is the scroll it is
          // entitled to, and a seven-column enemy table is allowed to scroll
          // inside its own container. The one overflow that is still a defect
          // is the page itself running sideways, which a reader cannot
          // recover from.
          const isDefect = (finding: OverflowFinding): boolean =>
            screen.document !== true ||
            (finding.axis === 'x' && finding.target === 'document')

          const findings = (await findOverflow(page)).filter(isDefect)
          if (findings.length > 0) {
            failures.push(`${screen.name}: ${formatFindings(findings)}`)
          }

          // Nothing on a document is cut off: what falls outside the viewport
          // is reached by scrolling to it.
          const clipped = screen.document === true
            ? []
            : await findClippedControls(page)
          if (clipped.length > 0) {
            failures.push(`${screen.name}: cut off — ${formatFindings(clipped)}`)
          }
        })
      }

      // Written whether or not the viewport passed, so the run leaves behind a
      // complete picture of the matrix rather than only its failures.
      await mkdir(SCREENSHOT_DIRECTORY, { recursive: true })
      await writeFile(
        `${SCREENSHOT_DIRECTORY}/${viewport.name}.json`,
        `${JSON.stringify({ viewport, failures }, null, 2)}
`,
        'utf8',
      )

      expect(failures.join('\n'), 'screens that do not fit this viewport').toBe('')
    })
  })
}
