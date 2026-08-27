import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { loadEnv } from 'vite'

const testEnvironment = loadEnv('test', process.cwd(), 'VITE_')
const testUserEmail = testEnvironment.VITE_TEST_USER_EMAIL
const testUserPassword = testEnvironment.VITE_TEST_USER_PASSWORD

async function signIn(page: Page): Promise<void> {
  test.skip(
    !testUserEmail || !testUserPassword,
    'VITE_TEST_USER_EMAIL and VITE_TEST_USER_PASSWORD are required for authenticated desktop flows.',
  )

  await page.getByLabel('Email').fill(testUserEmail)
  await page.getByLabel('Password').fill(testUserPassword)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(startRunButton(page)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
}

function startRunButton(page: Page) {
  return page.getByRole('button', { name: 'Start Run' }).first()
}

test('shows the sign-in gateway without mounting the arena', async ({ page }) => {
  await page.goto('/')

  await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible()
  await expect(page.locator('.game-canvas')).toHaveCount(0)
})

test('loads and persists dashboard settings while locking deeper floor tiers', async ({
  page,
}) => {
  await page.goto('/')
  await signIn(page)
  await expect(startRunButton(page)).toBeVisible()
  await expect(page.getByRole('region', { name: 'Ready for your next run?' }).getByText(testUserEmail, { exact: true })).toHaveCount(0)

  const defaultContract = page.getByRole('button', { name: /10 floors.*default/i })
  const twentyFloorContract = page.getByRole('button', { name: /20 floors/i })
  const fiftyFloorContract = page.getByRole('button', { name: /50 floors/i })
  const hundredFloorContract = page.getByRole('button', { name: /100 floors/i })
  await expect(defaultContract).toBeEnabled()
  await expect(defaultContract).toHaveAttribute('aria-pressed', 'true')
  await expect(twentyFloorContract).toBeDisabled()
  await expect(fiftyFloorContract).toBeDisabled()
  await expect(hundredFloorContract).toBeDisabled()

  await page.getByRole('button', { name: 'Cautious' }).click()
  await expect(page.getByRole('button', { name: 'Cautious' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
  await page.reload()
  await expect(page.getByRole('button', { name: 'Cautious' })).toHaveAttribute(
    'aria-pressed',
    'true',
  )
})

test('selects and persists world modifiers before starting a deterministic run', async ({
  page,
}) => {
  await page.goto('/')
  await signIn(page)

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
  await startRunButton(page).click()
  await expect(page.locator('.game-canvas')).toHaveAttribute(
    'data-world-modifiers',
    'elite-invasion,swarming',
  )
})

test('selects and persists a character before starting a run', async ({ page }) => {
  await page.goto('/')
  await signIn(page)
  const ranger = page.getByRole('button', { name: 'Ranger' })
  await ranger.click()
  await expect(ranger).toHaveAttribute('aria-pressed', 'true')
  await page.reload()
  await expect(ranger).toHaveAttribute('aria-pressed', 'true')
  await startRunButton(page).click()
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-playstyle', 'ranger')
})

test('starts a run without showing the in-run character guide', async ({ page }) => {
  await page.goto('/')
  await signIn(page)
  await page.getByRole('button', { name: 'Necromancer' }).click()
  await startRunButton(page).click()

  await expect(page.getByRole('complementary', { name: 'Run guide' })).toHaveCount(0)
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-game-phase', 'playing')
})

test('loads account progression outside the active run', async ({ page }) => {
  await page.goto('/')
  await signIn(page)
  await page.getByRole('button', { name: 'Upgrades!' }).click()

  await expect(
    page.getByRole('heading', { name: 'Spend your Essence.' }),
  ).toBeVisible()
  await expect(page.getByText('Unlock higher maximum floors')).toBeVisible()
  await expect(
    page.locator('.dashboard-choice strong').filter({
      hasText: /^default-dungeon-20-floor$/,
    }),
  ).toBeVisible()
})

test('signs in and out with the configured Supabase test account', async ({ page }) => {
  await page.goto('/')
  await signIn(page)
  await expect(startRunButton(page)).toBeVisible()

  await page.reload()
  await expect(startRunButton(page)).toBeVisible()

  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible()
})

test('runs the complete dashboard, gameplay, defeat, and return flow', async ({
  page,
}) => {
  await page.goto('/')
  await signIn(page)
  await startRunButton(page).click()

  await expect(
    page.getByRole('img', { name: 'Active Burger 4 game arena' }),
  ).toBeVisible()
  await expect(page.locator('.game-canvas')).toHaveAttribute(
    'data-game-phase',
    'playing',
  )
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
  await page.getByRole('button', { name: 'Open Meta Progression' }).click()
  await expect(
    page.getByRole('heading', { name: 'Essence and unlocks' }),
  ).toBeVisible()
})

test('keeps the arena running after endless combat begins', async ({ page }) => {
  await page.goto('/')
  await signIn(page)
  await startRunButton(page).click()
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
  expect(behaviorBox.y).toBeGreaterThan(520)

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
  await startRunButton(page).click()
  await expect(page.locator('.game-canvas')).toHaveAttribute(
    'data-game-phase',
    'playing',
  )

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
  await expect(page.getByRole('status')).toHaveText('Paused')

  const skill = page.getByRole('button', {
    name: 'Basic Attack, level 1',
  })
  await skill.focus()
  await expect(page.getByRole('tooltip')).toContainText('Basic Attack')

  await page.getByRole('button', { name: 'Development Menu' }).click()
  await expect(
    page.getByRole('heading', { name: 'Development Menu' }),
  ).toBeVisible()

  await page.keyboard.press('Escape')
  await expect(page.locator('.game-canvas')).toHaveAttribute(
    'data-game-phase',
    'playing',
  )
  await expect(page.getByRole('status')).toHaveCount(0)

  await page.getByRole('button', { name: 'Pause run' }).click()
  await expect(page.getByRole('status')).toHaveText('Paused')
  await page.getByRole('button', { name: 'Resume run' }).click()
  await expect(page.getByRole('status')).toHaveCount(0)
})

test('pauses and resumes an active choice flow on Escape', async ({ page }) => {
  await page.goto('/?demo=gear&devmenu=open')
  await signIn(page)
  await startRunButton(page).click()
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
  await expect(page.getByRole('button', { name: 'Development Menu' })).toBeDisabled()

  const skill = page.getByRole('button', {
    name: 'Basic Attack, level 1',
  })
  await skill.hover()
  await expect(page.getByRole('tooltip')).toContainText('Basic Attack')

  await page.keyboard.press('Escape')
  await expect(page.locator('.game-canvas')).toHaveAttribute(
    'data-game-phase',
    'paused',
  )
  await expect(page.getByRole('status')).toHaveText('Paused')

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
  await startRunButton(page).click()

  const skill = page.getByRole('button', {
    name: 'Basic Attack, level 1',
  })
  await expect(skill).toBeVisible()
  await skill.focus()
  await expect(
    page.getByRole('tooltip').getByText(
      'Estimated SINGLE-TARGET sustained DPS',
    ),
  ).toBeVisible()
  await expect(page.getByRole('tooltip')).toContainText('10')
  await expect(page.getByRole('tooltip')).toContainText('Relevant upgrades')
})

test('projects the final boss, stairs, transition, and victory result in development mode', async ({
  page,
}) => {
  await page.goto('/?demo=final-boss')
  await signIn(page)
  await startRunButton(page).click()
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

test('opens the in-run Behavior screen and switches profiles', async ({ page }) => {
  await page.goto('/')
  await signIn(page)
  await startRunButton(page).click()
  await expect(page.locator('.game-canvas')).toHaveAttribute(
    'data-game-phase',
    'playing',
  )

  const behaviorSummary = page.getByRole('button', {
    name: /Behavior: Balanced/i,
  })
  await expect(behaviorSummary).toBeVisible()
  await expect.poll(
    () => behaviorSummary.getAttribute('aria-label'),
  ).toMatch(/Intent: (?!No active intent).+/)
  await behaviorSummary.click()

  const behaviorScreen = page.getByRole('dialog', { name: 'Behavior' })
  await expect(behaviorScreen).toBeVisible()
  const cautious = behaviorScreen.locator('[data-profile-id="cautious"]')
  await expect(cautious).toContainText('Cautious')
  await cautious.click()
  await expect(cautious).toHaveAttribute('aria-pressed', 'true')
  await page.keyboard.press('Escape')
  await expect(behaviorScreen).toHaveCount(0)
  await expect(
    page.getByRole('button', { name: /Behavior: Cautious/i }),
  ).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('status')).toHaveText('Paused')
})

test('displays the level-up choices and resumes after selecting one', async ({
  page,
}) => {
  await page.goto('/?demo=level-up')
  await signIn(page)
  await expect(startRunButton(page)).toBeVisible()
  await startRunButton(page).click()
  await expect(page.locator('.game-canvas')).toHaveAttribute(
    'data-game-phase',
    'level-up',
  )

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

test('shows rarity-driven gear cards, deltas, and full comparisons', async ({
  page,
}) => {
  await page.goto('/?demo=gear')
  await signIn(page)
  await startRunButton(page).click()
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
  await expect(page.getByRole('button', { name: 'Development Menu' })).toBeDisabled()
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
  await expect(upgradeCard).toBeVisible()
  await expect(upgradeCard).toHaveClass(/gear-upgrade-card/)
  await expect(upgradeCard.locator('.gear-upgrade-type')).toHaveText(
    /upgrade equipped item/i,
  )
  await expect(upgradeCard.locator('.upgrade-choice-name')).toHaveText(
    /^Upgrade: /,
  )
  await expect(
    upgradeCard.locator('.choice-card-header [data-rarity="rare"]'),
  ).toBeVisible()
  await expect(upgradeCard).toContainText(/Upgrade equipped item/i)
  await expect(upgradeCard).toContainText(/current rarity/i)
  await expect(upgradeCard).toContainText(/upgraded rarity/i)
  await expect(upgradeCard).toContainText(/upgrade gains/i)
  await expect(upgradeCard.locator('.modifier-delta')).toBeVisible()
  await expect(upgradeCard).not.toContainText('Select to equip immediately')

  const loadout = page.getByRole('region', { name: 'Loadout' })
  await expect(loadout.locator('.loadout-item')).toHaveCount(6)
  await expect(loadout.locator('.loadout-item:not(:has(.loadout-empty))')).toHaveCount(1)
  await loadout.getByRole('button', { name: /armor: bastion plate/i }).focus()
  await expect(loadout.getByRole('tooltip')).toContainText('Bastion Plate')
})
