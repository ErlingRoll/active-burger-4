import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { loadEnv } from 'vite'

const testEnvironment = loadEnv('test', process.cwd(), 'VITE_')
const testUserEmail = testEnvironment.VITE_TEST_USER_EMAIL
const testUserPassword = testEnvironment.VITE_TEST_USER_PASSWORD

test.describe.configure({ mode: 'serial' })

async function signIn(page: Page): Promise<void> {
  test.skip(
    !testUserEmail || !testUserPassword,
    'VITE_TEST_USER_EMAIL and VITE_TEST_USER_PASSWORD are required for authenticated desktop flows.',
  )

  await page.getByLabel('Email').fill(testUserEmail)
  await page.getByLabel('Password').fill(testUserPassword)
  await page.getByLabel('Keep me signed in on this browser').check()
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(
    page.getByRole('button', { name: /Prepare dungeon/i }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
}

function startRunButton(page: Page) {
  return page.getByRole('button', { name: 'Start Run' }).first()
}

async function openRunSetup(page: Page): Promise<void> {
  await page.getByRole('button', { name: /Prepare dungeon/i }).click()
  await expect(startRunButton(page)).toBeVisible()
}

async function startRun(page: Page): Promise<void> {
  await startRunButton(page).click()
}

async function waitForPlaying(page: Page): Promise<void> {
  const canvas = page.locator('.game-canvas')
  const levelUpOverlay = page.getByRole('dialog', { name: /level \d+/i })

  await expect.poll(
    async () => {
      if ((await canvas.getAttribute('data-game-phase')) === 'level-up') {
        const skipButton = levelUpOverlay.getByRole('button', { name: 'Skip' })
        if (await skipButton.isVisible()) {
          await skipButton.click()
        }
      }
      return canvas.getAttribute('data-game-phase')
    },
    { timeout: 10_000 },
  ).toBe('playing')
}

test('shows the sign-in gateway without mounting the arena', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
  await expect(page.locator('.game-canvas')).toHaveCount(0)
})

test('loads and persists dashboard settings', async ({
  page,
}) => {
  await page.goto('/')
  await signIn(page)
  await openRunSetup(page)
  await expect(
    page.getByRole('heading', { name: 'Prepare your descent' }),
  ).toBeVisible()
  await expect(page.getByRole('group', { name: 'Character' })).toBeVisible()
  await expect(page.getByRole('group', { name: 'World modifiers' })).toBeVisible()
})

test('selects and persists world modifiers before starting a deterministic run', async ({
  page,
}) => {
  await page.goto('/')
  await signIn(page)
  await openRunSetup(page)

  const swarming = page.getByRole('button', { name: /swarming.*\+2/i })
  const eliteInvasion = page.getByRole('button', { name: /elite invasion.*\+5/i })
  await swarming.click()
  await eliteInvasion.click()
  await expect(swarming).toHaveAttribute('aria-pressed', 'true')
  await expect(eliteInvasion).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Difficulty 7 · Essence reward 1.38x')).toBeVisible()

  await page.reload()
  await expect(swarming).toHaveAttribute('aria-pressed', 'true')
  await expect(eliteInvasion).toHaveAttribute('aria-pressed', 'true')
  await startRun(page)
  await expect(page.locator('.game-canvas')).toHaveAttribute(
    'data-world-modifiers',
    'elite-invasion,swarming',
  )
})

test('selects and persists a character before starting a run', async ({ page }) => {
  await page.goto('/')
  await signIn(page)
  await openRunSetup(page)
  const ranger = page.getByRole('button', { name: 'Ranger' })
  await ranger.click()
  await expect(ranger).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  await expect(ranger).toHaveAttribute('aria-pressed', 'true')
  await startRun(page)
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-playstyle', 'ranger')
})

test('starts a run without showing the in-run character guide', async ({ page }) => {
  await page.goto('/')
  await signIn(page)
  await openRunSetup(page)
  await page.getByRole('button', { name: 'Necromancer' }).click()
  await startRun(page)

  await expect(page.getByRole('complementary', { name: 'Run guide' })).toHaveCount(0)
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-game-phase', 'playing')
})

test('loads the permanent upgrade store outside the active run', async ({ page }) => {
  await page.goto('/')
  await signIn(page)
  await page.getByRole('button', { name: /Essence store/i }).click()

  await expect(
    page.getByRole('heading', { name: 'Spend your Essence.' }),
  ).toBeVisible()
  await expect(page.getByText('XP multiplier', { exact: true })).toBeVisible()
  await expect(page.getByText('Increased XP')).toBeVisible()
  await expect(
    page.locator('.meta-unlock-card').filter({ hasText: 'Increased XP' })
      .locator('.meta-unlock-card-multiplier'),
  ).toContainText(/\d+\.\d+x/)
  await expect(
    page.locator('.meta-unlock-card').filter({ hasText: 'Increased XP' })
      .locator('.meta-unlock-card-benefit'),
  ).toContainText('+5% XP multiplier')
  await expect(
    page.locator('.meta-unlock-card').filter({ hasText: 'Increased XP' })
      .locator('.meta-unlock-card-benefit'),
  ).toContainText(/\d+\.\d+x → \d+\.\d+x/)
  await expect(page.getByText('Starting Level', { exact: true })).toBeVisible()
  await expect(page.getByText(/Start at level \d+/, { exact: false })).toBeVisible()
  await expect(page.getByText('Expanded Skill Slots')).toBeVisible()
  await expect(page.getByText('+1 maximum skill')).toBeVisible()
  await expect(
    page.locator('.dashboard-choice strong').filter({
      hasText: 'Increased XP',
    }),
  ).toBeVisible()
  await expect(page.locator('.dashboard-choice')).toHaveCount(3)
})

test('signs in and out with the configured Supabase test account', async ({ page }) => {
  await page.goto('/')
  await signIn(page)
  await expect(
    page.getByRole('button', { name: /Prepare dungeon/i }),
  ).toBeVisible()

  await page.reload()
  await expect(
    page.getByRole('button', { name: /Prepare dungeon/i }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible()
})

test('runs the complete dashboard, gameplay, defeat, and return flow', async ({
  page,
}) => {
  await page.goto('/')
  await signIn(page)
  await openRunSetup(page)
  await startRun(page)
  await waitForPlaying(page)

  await expect(
    page.getByRole('img', { name: 'Active Burger 4 game arena' }),
  ).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Run status' })).toBeAttached()
  await expect(page.locator('.hud-stats .hud-stat')).toHaveCount(3)
  await expect(page.getByText('Dodge Lv.')).toHaveCount(0)
  await expect(page.getByText('Encounter timeline')).toHaveCount(0)
  await expect(page.getByText('Pickups')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'End Run' })).toHaveCount(0)
  const floorBox = await page.locator('.floor-hud-top').boundingBox()
  if (!floorBox) {
    throw new Error('Expected floor HUD to be visible')
  }
  expect(floorBox.width).toBeGreaterThan(200)
  expect(floorBox.width).toBeLessThan(500)
  expect(floorBox.y).toBeLessThan(240)

  await page.getByRole('button', { name: 'Development Menu' }).click()
  const developmentMenu = page.getByRole('heading', {
    name: 'Development Menu',
  }).locator('..')
  await expect(developmentMenu).toBeVisible()
  await expect(developmentMenu.getByText('Total entities')).toBeVisible()
  await expect(
    developmentMenu.getByRole('button', { name: 'Spawn 100 enemies' }),
  ).toBeVisible()
  await expect(
    developmentMenu.getByRole('button', { name: 'Spawn 500 enemies' }),
  ).toBeVisible()
  await expect(
    developmentMenu.getByRole('button', { name: 'Spawn 1000 enemies' }),
  ).toBeVisible()
  const gearOptions = await developmentMenu
    .getByLabel('Gear item')
    .locator('option')
    .allTextContents()
  expect(gearOptions.some((label) => label.includes('Training'))).toBe(false)
  await developmentMenu.getByLabel('Gear set').selectOption('splintering')
  await developmentMenu.getByLabel('Gear item').selectOption('hunters-bow')
  await developmentMenu.getByRole('button', { name: 'Give gear' }).click()
  await expect(developmentMenu.getByRole('status')).toContainText(
    'Granted Splintering Bow.',
  )
  await developmentMenu.getByLabel('Skill').selectOption('whirlwind')
  await developmentMenu.getByRole('button', { name: 'Give skill' }).click()
  await expect(developmentMenu.getByRole('status')).toContainText(
    /(?:Granted Whirlwind|Whirlwind is already equipped)\./,
  )
  await developmentMenu.getByLabel('Upgrade').selectOption('whirlwind-leech')
  await developmentMenu.getByRole('button', { name: 'Give upgrade' }).click()
  await expect(developmentMenu.getByRole('status')).toContainText(
    'Granted Sanguine Whirlwind.',
  )

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
  await expect(page.getByText('Level', { exact: true })).toBeVisible()
  await expect(page.getByText('XP', { exact: true })).toBeVisible()
  await expect(page.getByText('Kills', { exact: true })).toBeVisible()
  await expect(page.locator('.game-canvas')).toHaveCount(0)

  await page.getByRole('button', { name: 'Return to Dashboard' }).click()
  await expect(
    page.getByRole('heading', { name: 'The dungeon is waiting.' }),
  ).toBeVisible()
  await expect(page.locator('.game-canvas')).toHaveCount(0)
  await page.getByRole('button', { name: /Essence store/i }).click()
  await expect(
    page.getByRole('heading', { name: 'Spend your Essence.' }),
  ).toBeVisible()
})

test('keeps the arena running after endless combat begins', async ({ page }) => {
  await page.goto('/')
  await signIn(page)
  await openRunSetup(page)
  await startRun(page)
  await expect(page.locator('.game-canvas')).toHaveAttribute(
    'data-game-phase',
    'playing',
  )
  const behaviorHud = page.locator('.behavior-hud')

  const behaviorBox = await behaviorHud.boundingBox()
  if (!behaviorBox) {
    throw new Error('Expected behavior HUD to be visible')
  }
  const viewport = page.viewportSize()
  expect(behaviorBox.x).toBeGreaterThan((viewport?.width ?? 1280) / 2)
  expect(behaviorBox.y).toBeGreaterThan((viewport?.height ?? 720) / 2)

  const characterStats = page.locator('.character-stats')
  const characterStatsBox = await characterStats.boundingBox()
  if (!characterStatsBox) {
    throw new Error('Expected character stats HUD to be visible')
  }
  expect(characterStatsBox.x).toBeLessThan(120)
  expect(characterStatsBox.y + characterStatsBox.height).toBeGreaterThan(
    (viewport?.height ?? 720) - 40,
  )

  const statGroups = page.locator('.character-stat-group')
  await expect(statGroups).toHaveCount(2)
  const offenceBox = await statGroups.nth(0).boundingBox()
  const defenceBox = await statGroups.nth(1).boundingBox()
  if (!offenceBox || !defenceBox) {
    throw new Error('Expected offence and defence stat columns to be visible')
  }
  expect(defenceBox.x).toBeGreaterThan(offenceBox.x)

  // The director's first budgeted spawn occurs after roughly one second.
  await page.waitForTimeout(1_200)
  await expect(page.locator('.game-canvas')).toHaveAttribute(
    'data-game-phase',
    'playing',
  )
})

test('pauses on Escape without blocking HUD or development controls', async ({
  page,
}) => {
  await page.goto('/')
  await signIn(page)
  await openRunSetup(page)
  await startRun(page)
  await waitForPlaying(page)

  await page.evaluate(() => {
    document.addEventListener(
      'keydown',
      (event) => event.preventDefault(),
      { once: true },
    )
  })
  await page.keyboard.press('Escape')
  await expect(page.locator('.game-canvas')).toHaveAttribute(
    'data-game-phase',
    'paused',
  )
  await expect(page.getByRole('dialog', { name: 'Pause menu' })).toBeVisible()
  const pauseMenu = page.getByRole('dialog', { name: 'Pause menu' })
  await expect(pauseMenu.getByRole('button', { name: 'Forfeit' })).toBeVisible()
  await pauseMenu.getByRole('button', { name: 'Forfeit' }).click()
  const confirmation = page.getByRole('dialog', { name: 'Forfeit run?' })
  await expect(confirmation).toBeVisible()
  await expect(confirmation).toContainText(
    'Are you sure you want to forfeit your current character and leave the dungeon?',
  )
  await confirmation.getByRole('button', { name: 'Cancel' }).click()
  await expect(confirmation).toHaveCount(0)
  const pauseLayers = await page.locator('.game-renderer').evaluate((renderer) => {
    const canvas = renderer.parentElement
    const hud = canvas?.querySelector('.gameplay-hud')
    const developmentControls = canvas?.querySelector('.development-controls')
    return {
      rendererOverlay: getComputedStyle(renderer, '::after').backgroundColor,
      hudOpacity: hud ? getComputedStyle(hud).opacity : null,
      developmentControlsZIndex: developmentControls
        ? getComputedStyle(developmentControls).zIndex
        : null,
    }
  })
  expect(pauseLayers.rendererOverlay).toBe('rgba(2, 6, 23, 0.78)')
  expect(pauseLayers.hudOpacity).toBe('1')
  expect(pauseLayers.developmentControlsZIndex).toBe('9')

  const skill = page.getByRole('button', {
    name: 'Basic Attack, level 1',
  })
  await skill.focus()
  await expect(page.getByRole('tooltip')).toContainText('Basic Attack')

  await page.getByRole('button', { name: 'Development Menu' }).click()
  const pausedDevelopmentMenu = page.getByRole('heading', {
    name: 'Development Menu',
  }).locator('..')
  await expect(pausedDevelopmentMenu).toBeVisible()
  await pausedDevelopmentMenu.getByLabel('Gear item').selectOption('hunters-bow')
  await pausedDevelopmentMenu.getByRole('button', { name: 'Give gear' }).click()
  await expect(pausedDevelopmentMenu.getByRole('status')).toContainText('Granted Bow.')

  await page.getByRole('dialog', { name: 'Pause menu' })
    .getByRole('button', { name: 'Resume run' }).click()
  await expect(page.getByRole('dialog', { name: 'Pause menu' })).toHaveCount(0)
  await expect(
    page.getByRole('heading', { name: 'Development Menu' }),
  ).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.locator('.game-canvas')).toHaveAttribute(
    'data-game-phase',
    'paused',
  )
  await expect(page.getByRole('dialog', { name: 'Pause menu' })).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.locator('.game-canvas')).toHaveAttribute(
    'data-game-phase',
    'playing',
  )
  await expect(page.getByRole('dialog', { name: 'Pause menu' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Pause run' }).click()
  await expect(page.getByRole('dialog', { name: 'Pause menu' })).toBeVisible()
  await page.getByRole('dialog', { name: 'Pause menu' })
    .getByRole('button', { name: 'Resume run' }).click()
  await expect(page.getByRole('dialog', { name: 'Pause menu' })).toHaveCount(0)
})

test('pauses and resumes an active choice flow on Escape', async ({ page }) => {
  await page.goto('/?demo=gear')
  await signIn(page)
  await openRunSetup(page)
  await startRun(page)
  await expect(page.locator('.game-canvas')).toHaveAttribute(
    'data-game-phase',
    'level-up',
  )

  const overlay = page.getByRole('dialog', { name: /choose your gear/i })
  await expect(overlay).toBeVisible()
  await expect(page.getByRole('button', { name: 'Development Menu' })).toHaveAttribute(
    'aria-expanded',
    'false',
  )

  await page.keyboard.press('Escape')
  await expect(page.locator('.game-canvas')).toHaveAttribute(
    'data-game-phase',
    'paused',
  )
  await expect(page.getByRole('dialog', { name: 'Pause menu' })).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.locator('.game-canvas')).toHaveAttribute(
    'data-game-phase',
    'level-up',
  )
  await expect(overlay).toBeVisible()
})

test('shows an accessible acquired-skill tooltip with a DPS assumption', async ({
  page,
}) => {
  await page.goto('/')
  await signIn(page)
  await openRunSetup(page)
  await startRun(page)
  await waitForPlaying(page)
  await page.setViewportSize({ width: 579, height: 325 })

  const skill = page.getByRole('button', {
    name: 'Basic Attack, level 1',
  })
  await expect(skill).toBeVisible()
  await skill.hover()
  const tooltip = page.getByRole('tooltip')
  await expect(tooltip).toBeVisible()
  await expect.poll(async () => {
    const box = await tooltip.boundingBox()
    return box ? box.y + box.height : 0
  }).toBeLessThanOrEqual(325)
  const tooltipBox = await tooltip.boundingBox()
  if (!tooltipBox) {
    throw new Error('Expected skill tooltip to have a visible bounding box')
  }
  expect(tooltipBox.y).toBeGreaterThanOrEqual(0)
  expect(tooltipBox.y + tooltipBox.height).toBeLessThanOrEqual(325)
  await expect(page.getByRole('tooltip')).toContainText(
    'Estimated combined single-target sustained DPS',
  )
  await skill.focus()
  await expect(
    page.getByRole('tooltip').getByText(
      'Estimated combined single-target sustained DPS',
    ),
  ).toBeVisible()
  await expect(page.getByRole('tooltip')).toContainText('15')
})

test('projects the final boss, stairs, transition, and victory result in development mode', async ({
  page,
}) => {
  await page.goto('/?demo=final-boss')
  await signIn(page)
  await openRunSetup(page)
  await startRun(page)
  await expect(page.locator('.game-canvas')).toHaveAttribute(
    'data-game-phase',
    'playing',
  )

  await expect(page.getByRole('region', { name: 'Boss status' })).toContainText(
    'Inferno Warden',
  )
  await expect(page.getByLabel('Inferno Warden enrage')).toContainText('Enrage')

  await page.getByRole('button', { name: 'Development Menu' }).click()
  const menu = page.getByRole('heading', { name: 'Development Menu' }).locator('..')
  await menu.getByRole('button', { name: 'Test final stairs & results' }).click()
  await expect(page.getByRole('status')).toContainText('Descending')
  await expect(page.getByRole('heading', { name: 'Victory' })).toBeVisible({
    timeout: 3_000,
  })
})

test('switches in-run movement behavior profiles', async ({ page }) => {
  await page.goto('/')
  await signIn(page)
  await openRunSetup(page)
  await startRun(page)
  await expect(page.locator('.game-canvas')).toHaveAttribute(
    'data-game-phase',
    'playing',
  )

  const cautious = page.getByRole('button', { name: /Cautious:/i })
  await expect(cautious).toBeVisible()
  await cautious.click()
  await expect(cautious).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Intent:')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Pause menu' })).toBeVisible()
})

test('displays the level-up choices and resumes after selecting one', async ({
  page,
}) => {
  await page.goto('/?demo=level-up')
  await signIn(page)
  await openRunSetup(page)
  await startRun(page)
  await expect(page.locator('.game-canvas')).toHaveAttribute(
    'data-game-phase',
    'level-up',
  )

  const overlay = page.getByRole('dialog', { name: /level 2/i })
  await expect(overlay).toBeVisible()
  await expect(overlay.locator('.upgrade-choice')).toHaveCount(3)

  const firstChoice = overlay.getByRole('button').first()
  await expect(firstChoice).toBeFocused()
  await firstChoice.click()

  await expect(overlay).toBeHidden()
  await expect(page.locator('.game-canvas')).toHaveAttribute(
    'data-game-phase',
    'playing',
    { timeout: 1_000 },
  )
})

test('skips level-up choices with the default keybind', async ({ page }) => {
  await page.goto('/?demo=level-up')
  await signIn(page)
  await openRunSetup(page)
  await startRun(page)
  await expect(page.locator('.game-canvas')).toHaveAttribute(
    'data-game-phase',
    'level-up',
  )

  const overlay = page.getByRole('dialog', { name: /level 2/i })
  await expect(overlay).toBeVisible()
  const skipButton = overlay.getByRole('button', { name: 'Skip' })
  await expect(skipButton).toHaveAttribute('aria-keyshortcuts', '5')
  await page.keyboard.press('5')

  await expect(overlay).toBeHidden()
  await expect(page.locator('.game-canvas')).toHaveAttribute(
    'data-game-phase',
    'playing',
  )
})

test('shows rarity-driven gear cards, deltas, and full comparisons', async ({
  page,
}) => {
  await page.goto('/?demo=gear')
  await signIn(page)
  await openRunSetup(page)
  await startRun(page)
  await expect(page.locator('.game-canvas')).toHaveAttribute(
    'data-game-phase',
    'level-up',
  )

  const overlay = page.getByRole('dialog', { name: /choose your gear/i })
  await expect(overlay).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Development Menu' }),
  ).toBeVisible()
  await expect(page.getByRole('button', { name: 'Development Menu' })).toHaveAttribute(
    'aria-expanded',
    'false',
  )
  const gearCards = overlay.locator('[data-choice-type="gear"]')
  await expect(gearCards).toHaveCount(3)
  await expect(gearCards.locator('.gear-upgrade-type')).toHaveCount(0)
  await expect(gearCards.first().locator('[data-rarity]')).toBeVisible()
  await expect(gearCards.first()).toContainText(/weapon|helmet|armor|boots|ring|amulet/i)
  await expect(gearCards.first()).toContainText(/gains|net change/i)
  await gearCards.first().focus()
  await expect(overlay.getByRole('tooltip')).toContainText('Full comparison')
  await expect(overlay.getByRole('tooltip')).toContainText('Offered')
  await expect(overlay.getByRole('tooltip')).toContainText('Equipped in')
  await gearCards.first().click()

  const upgradeCard = overlay.locator('[data-choice-type="gear-upgrade"]')
  if (await upgradeCard.count() > 0) {
    await expect(upgradeCard).toBeVisible()
    await expect(upgradeCard).toHaveClass(/gear-upgrade-card/)
    await expect(upgradeCard.locator('.gear-upgrade-type')).toHaveText(
      /upgrade equipped item/i,
    )
    await expect(upgradeCard.locator('.upgrade-choice-name')).toHaveText(
      /^Upgrade: /,
    )
    await expect(upgradeCard.locator('[data-rarity]')).toBeVisible()
    await expect(upgradeCard).toContainText(/Upgrade equipped item/i)
    await expect(upgradeCard).toContainText(/T\d+.*→.*T\d+/)
    await expect(upgradeCard).toContainText(/upgrade gains/i)
    await expect(upgradeCard).not.toContainText('Select to equip immediately')
  }

  const loadout = page.getByRole('region', { name: 'Loadout' })
  await expect(loadout.locator('.loadout-item')).toHaveCount(6)
  const equippedItems = loadout.locator('.loadout-item:not(:has(.loadout-empty))')
  await expect(equippedItems).not.toHaveCount(0)
  await equippedItems.last().focus()
  await expect(loadout.locator('.loadout-tooltip')).toBeVisible()
})

test('uses a custom skip key immediately', async ({ page }) => {
  await page.goto('/?demo=level-up')
  await signIn(page)
  await openRunSetup(page)
  await startRun(page)

  const canvas = page.locator('.game-canvas')
  await expect(canvas).toHaveAttribute('data-game-phase', 'level-up')
  const overlay = page.getByRole('dialog', { name: /level 2/i })
  await expect(overlay).toBeVisible()

  await page.keyboard.press('Escape')
  const pauseMenu = page.getByRole('dialog', { name: 'Pause menu' })
  await expect(pauseMenu).toBeVisible()
  const skipBinding = pauseMenu.getByRole('button', {
    name: /Rebind Skip choice, current key 5/i,
  })
  await skipBinding.click()
  await page.keyboard.press('x')
  await expect(
    pauseMenu.getByRole('button', {
      name: /Rebind Skip choice, current key X/i,
    }),
  ).toBeVisible()

  await pauseMenu.getByRole('button', { name: 'Resume run' }).click()
  await expect(overlay).toBeVisible()
  const skipButton = overlay.getByRole('button', { name: 'Skip' })
  await expect(skipButton).toHaveAttribute('aria-keyshortcuts', 'x')

  await page.keyboard.press('5')
  await expect(overlay).toBeVisible()
  await page.keyboard.press('x')
  await expect(overlay).toBeHidden()
  await expect(canvas).toHaveAttribute('data-game-phase', 'playing', {
    timeout: 1_000,
  })

  await page.keyboard.press('Escape')
  await expect(pauseMenu).toBeVisible()
  const customSkipBinding = pauseMenu.getByRole('button', {
    name: /Rebind Skip choice, current key X/i,
  })
  await customSkipBinding.click()
  await page.keyboard.press('5')
  await expect(
    pauseMenu.getByRole('button', {
      name: /Rebind Skip choice, current key 5/i,
    }),
  ).toBeVisible()
  await pauseMenu.getByRole('button', { name: 'Resume run' }).click()
})
