import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { requireTestCredentials } from './support/credentials'

test.describe.configure({ mode: 'serial' })

async function clearExistingRun(page: Page): Promise<void> {
  await expect(page.locator('.game-dashboard')).toHaveAttribute(
    'data-run-persistence-state',
    /ready|error|unavailable/,
    { timeout: 15_000 },
  )
  const currentDungeon = page.getByRole('heading', { name: 'An expedition awaits' })
  const startRunLink = page.getByRole('button', { name: /Begin dungeon run|Start a dungeon run/i })
  await expect.poll(
    async () => {
      if (await currentDungeon.count() > 0 || await startRunLink.count() > 0) {
        return true
      }
      return false
    },
    { timeout: 15_000 },
  ).toBe(true)
  if (await currentDungeon.count() === 0) {
    return
  }
  const forfeitButton = page.getByRole('button', { name: 'Forfeit run' }).last()
  if (await forfeitButton.count() === 0) {
    return
  }
  await forfeitButton.click()
  const confirmation = page.getByRole('dialog', { name: 'Forfeit dungeon run?' })
  await confirmation.getByRole('button', { name: 'Forfeit run' }).click()
  await expect(page.getByRole('heading', { name: 'Defeat' })).toBeVisible()
  await page.getByRole('button', { name: 'Return to Dashboard' }).click()
  await expect(startRunLink).toBeVisible()
}

function classifyRunPersistence(
  persistenceState: string | null,
): 'loading' | 'available' | 'unavailable' {
  if (persistenceState === 'error' || persistenceState === 'unavailable') {
    return 'unavailable'
  }
  return persistenceState === 'ready' ? 'available' : 'loading'
}

async function requireRunPersistence(page: Page): Promise<void> {
  const dashboard = page.locator('.game-dashboard')
  await expect.poll(
    async () => classifyRunPersistence(
      await dashboard.getAttribute('data-run-persistence-state'),
    ),
    { timeout: 10_000 },
  ).toMatch(/available|unavailable/)

  // Re-read after the poll settles rather than mutating a variable from inside
  // the polling callback, which hides the outcome from control-flow analysis.
  const settledStatus = classifyRunPersistence(
    await dashboard.getAttribute('data-run-persistence-state'),
  )
  if (settledStatus === 'unavailable') {
    test.skip(true, 'The configured Supabase project has not applied the durable dungeon run migration.')
  }
}

async function signIn(page: Page): Promise<void> {
  const { email, password } = requireTestCredentials('authenticated desktop flows')

  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByLabel('Keep me signed in on this browser').check()
  await page.getByRole('button', { name: 'Sign in' }).click()
  await expect(page.getByRole('button', { name: 'Sign out' })).toBeVisible()
  await requireRunPersistence(page)
  await clearExistingRun(page)
  await expect(
    page.getByRole('button', { name: /Begin dungeon run|Start a dungeon run/i }),
  ).toBeVisible()
}

function startRunButton(page: Page) {
  return page.getByRole('button', { name: 'Start Run' }).first()
}

async function openRunSetup(page: Page): Promise<void> {
  await clearExistingRun(page)
  await expect(page.locator('.game-dashboard')).toHaveAttribute(
    'data-run-persistence-state',
    'ready',
    { timeout: 15_000 },
  )
  await page.getByRole('button', { name: /Begin dungeon run|Start a dungeon run/i }).click()
  await expect(startRunButton(page)).toBeVisible()
}

async function startRun(page: Page): Promise<void> {
  await startRunButton(page).click()
  const canvas = page.locator('.game-canvas')
  await expect(canvas).toBeVisible({ timeout: 15_000 })
  const preservesChoiceDemo = ['demo=gear', 'demo=level-up', 'demo=starting-level-up']
    .some((demo) => page.url().includes(demo))
  if (
    !preservesChoiceDemo &&
    await canvas.getAttribute('data-game-phase') === 'level-up'
  ) {
    for (let choiceIndex = 0; choiceIndex < 5; choiceIndex += 1) {
      if (await canvas.getAttribute('data-game-phase') !== 'level-up') {
        break
      }
      await page.keyboard.press('5')
      await expect.poll(
        () => canvas.getAttribute('data-game-phase'),
        { timeout: 2_000 },
      ).toMatch(/playing|level-up/)
    }
    await expect(canvas).toHaveAttribute('data-game-phase', 'playing', {
      timeout: 2_000,
    })
  }
}

async function waitForPlaying(page: Page): Promise<void> {
  const canvas = page.locator('.game-canvas')

  await expect.poll(
    () => canvas.getAttribute('data-game-phase'),
    { timeout: 10_000 },
  ).toMatch(/playing|level-up/)
}

async function finishActiveRun(page: Page): Promise<void> {
  const canvas = page.locator('.game-canvas')
  if (await canvas.count() === 0) {
    return
  }
  const phase = await canvas.getAttribute('data-game-phase')
  if (phase === 'floor-transition') {
    await expect.poll(
      () => canvas.getAttribute('data-game-phase'),
      { timeout: 15_000 },
    ).toMatch(/playing|results/)
  }
  const currentPhase = await canvas.getAttribute('data-game-phase')
  if (currentPhase === 'results') {
    return
  }
  if (currentPhase !== 'paused') {
    await page.keyboard.press('Escape')
  }
  const pauseMenu = page.getByRole('dialog', { name: 'Pause menu' })
  await expect(pauseMenu).toBeVisible()
  await pauseMenu.getByRole('button', { name: 'Forfeit' }).click()
  const confirmation = page.getByRole('dialog', { name: 'Forfeit run?' })
  await confirmation.getByRole('button', { name: 'Forfeit' }).click()
  await expect(page.getByRole('heading', { name: 'Defeat' })).toBeVisible()
}

test.afterEach(async ({ page }) => {
  await finishActiveRun(page)
})

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
    page.getByRole('heading', { name: 'Dungeon run' }),
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

  const modifierButtons = page
    .getByRole('group', { name: 'World modifiers' })
    .getByRole('button')
  await expect(modifierButtons).toHaveText([
    /Swarming.*Reward 1\.10x/,
    /Fast Start.*Reward 1\.08x/,
    /Juggernauts.*Reward 1\.20x/,
    /Glass World.*Reward 1\.15x/,
    /Shorter Minute.*Reward 1\.15x/,
    /Elite Invasion.*Reward 1\.20x/,
    /Elite Triad.*Reward 1\.25x/,
  ])
  const swarming = page.getByRole('button', { name: /swarming.*reward 1\.10x/i })
  const eliteInvasion = page.getByRole('button', {
    name: /elite invasion.*reward 1\.20x/i,
  })
  await swarming.click()
  await eliteInvasion.click()
  await expect(swarming).toHaveAttribute('aria-pressed', 'true')
  await expect(eliteInvasion).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByText('Difficulty 7 · Essence reward 1.30x')).toBeVisible()

  await page.reload()
  await expect(swarming).toHaveAttribute('aria-pressed', 'true')
  await expect(eliteInvasion).toHaveAttribute('aria-pressed', 'true')
  await page.getByRole('button', { name: 'Back to dashboard' }).click()
  await requireRunPersistence(page)
  await openRunSetup(page)
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
  await page.getByRole('button', { name: 'Back to dashboard' }).click()
  await requireRunPersistence(page)
  await openRunSetup(page)
  await startRun(page)
  await expect(page.locator('.game-canvas')).toHaveAttribute('data-character-class', 'ranger')
})

test('starts a run without showing the in-run character guide', async ({ page }) => {
  await page.goto('/')
  await signIn(page)
  await openRunSetup(page)
  await page.getByRole('button', { name: 'Necromancer' }).click()
  await startRun(page)

  await expect(page.getByRole('complementary', { name: 'Run guide' })).toHaveCount(0)
  await expect(page.locator('.game-canvas')).toHaveAttribute(
    'data-game-phase',
    /playing|level-up/,
  )
})

test('loads the permanent upgrade store outside the active run', async ({ page }) => {
  await page.goto('/')
  await signIn(page)
  await page.getByRole('button', { name: /Spend at the store/i }).click()

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
  await expect(page.locator('.meta-unlock-card')).toHaveCount(6)
})

test('signs in and out with the configured Supabase test account', async ({ page }) => {
  await page.goto('/')
  await signIn(page)
  await expect(
    page.getByRole('button', { name: /Begin dungeon run|Start a dungeon run/i }),
  ).toBeVisible()

  await page.reload()
  await expect(
    page.getByRole('button', { name: /Begin dungeon run|Start a dungeon run/i }),
  ).toBeVisible()

  await page.getByRole('button', { name: 'Sign out' }).click()
  await expect(page.getByRole('heading', { name: 'Sign in to continue' })).toBeVisible()
})

test('persists an active run, blocks the store, and continues after Save & quit', async ({
  page,
}) => {
  await page.goto('/')
  await signIn(page)
  await openRunSetup(page)
  await startRun(page)
  await waitForPlaying(page)

  await page.keyboard.press('Escape')
  const pauseMenu = page.getByRole('dialog', { name: 'Pause menu' })
  await expect(pauseMenu).toBeVisible()
  await pauseMenu.getByRole('button', { name: 'Save & quit' }).click()
  await expect(page.getByRole('heading', { name: 'An expedition awaits' })).toBeVisible()

  const store = page.getByRole('button', { name: /Spend at the store/i })
  await expect(store).toBeDisabled()
  await expect(store).toHaveAttribute(
    'title',
    'Finish or forfeit your current dungeon run before opening the Essence store.',
  )
  await expect(page.getByText('Finish or forfeit this run before using the Essence store.'))
    .toBeVisible()
  await expect(page.locator('dt').filter({ hasText: 'Floor' })).toBeVisible()
  await expect(page.locator('dd').filter({ hasText: /^1 \// })).toBeVisible()
  await expect(page.getByText('Class')).toBeVisible()

  await page.goto('/store')
  await expect(page.getByRole('heading', { name: 'An expedition awaits' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Spend your Essence.' })).toHaveCount(0)

  await page.getByRole('button', { name: 'Resume dungeon' }).click()
  await expect(page.locator('.game-canvas')).toBeVisible()
  await waitForPlaying(page)
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
  // What stays on the arena is what has to be read while playing: the vitals.
  const vitals = page.locator('.hud-vitals')
  await expect(vitals).toBeVisible()
  await expect(vitals).toContainText('HP')
  await expect(vitals).toContainText(/Lv \d+/)

  // The run totals moved behind the toolbar, so the test opens the door the
  // player opens rather than asserting they are always on screen.
  await page.getByRole('button', { name: 'Run details', exact: true }).click()
  const dungeonStats = page.locator('.dungeon-stats')
  await expect(dungeonStats).toContainText('Dungeon stats')
  await expect(dungeonStats).toContainText('Floor')
  await expect(dungeonStats).toContainText('Essence')
  await expect(dungeonStats).toContainText('Kills')
  await expect(dungeonStats.locator('.dungeon-stat')).toHaveCount(4)
  await expect(dungeonStats.locator('.dungeon-stat').nth(1).locator('dd'))
    .toHaveText(/^\d+$/)
  const dungeonStatBoxes = await Promise.all(
    [0, 1, 2, 3].map((index) =>
      dungeonStats.locator('.dungeon-stat').nth(index).boundingBox(),
    ),
  )
  if (dungeonStatBoxes.some((box) => !box)) {
    throw new Error('Expected all dungeon stats to be visible')
  }
  // Reading order, not one column. The old panel was pinned over the arena and
  // had to be a single stack to stay out of the way; inside the sheet the list
  // is free to use the width, so this only asks that the stats run downward.
  expect(dungeonStatBoxes[1]!.y).toBeGreaterThanOrEqual(dungeonStatBoxes[0]!.y)
  expect(dungeonStatBoxes[2]!.y).toBeGreaterThanOrEqual(dungeonStatBoxes[1]!.y)
  expect(dungeonStatBoxes[3]!.y).toBeGreaterThanOrEqual(dungeonStatBoxes[2]!.y)
  await page.getByRole('button', { name: 'Close run details' }).click()
  await expect(dungeonStats).toHaveCount(0)
  await expect(page.getByText('Dodge Lv.')).toHaveCount(0)
  await expect(page.getByText('Encounter timeline')).toHaveCount(0)
  await expect(page.getByText('Pickups')).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'End Run' })).toHaveCount(0)
  const viewport = page.viewportSize()
  if (!viewport) {
    throw new Error('Expected a browser viewport')
  }
  /*
   * What is left on the arena, and all of it inside the viewport.
   *
   * This used to pin the stats to the right edge and the floor panel to the
   * centre within forty pixels, which described where the old fixed panels sat
   * rather than anything a player needs. The panels are laid out by the HUD's
   * own flow now, so the requirement is the one that still means something:
   * nothing the player has to read while playing is off the screen.
   */
  for (const selector of ['.hud-vitals', '.floor-hud', '.hud-toolbar']) {
    const box = await page.locator(selector).first().boundingBox()
    if (!box) {
      throw new Error(`Expected ${selector} to be visible`)
    }
    expect(box.width).toBeGreaterThan(0)
    expect(box.height).toBeGreaterThan(0)
    expect(box.x).toBeGreaterThanOrEqual(0)
    expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1)
    expect(box.y).toBeGreaterThanOrEqual(0)
    expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1)
  }

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
    page.getByRole('heading', { name: 'Choose your descent' }),
  ).toBeVisible()
  await expect(page.locator('.game-canvas')).toHaveCount(0)
  await page.getByRole('button', { name: /Spend at the store/i }).click()
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
  // Movement behaviour stays on the arena, because it is changed mid-fight.
  const viewport = page.viewportSize()
  const behaviorBox = await page.locator('.hud-behavior').boundingBox()
  if (!behaviorBox) {
    throw new Error('Expected the behaviour control to be visible')
  }
  expect(behaviorBox.x).toBeGreaterThanOrEqual(0)
  expect(behaviorBox.x + behaviorBox.width)
    .toBeLessThanOrEqual((viewport?.width ?? 1280) + 1)

  // The stat sheet is reference rather than status, so it lives behind the
  // toolbar and the test opens it the way a player would.
  await page.getByRole('button', { name: 'Stats details', exact: true }).click()
  await expect(page.locator('.character-stats')).toBeVisible()
  const statGroups = page.locator('.character-stat-group')
  await expect(statGroups).toHaveCount(2)
  const offenceBox = await statGroups.nth(0).boundingBox()
  const defenceBox = await statGroups.nth(1).boundingBox()
  if (!offenceBox || !defenceBox) {
    throw new Error('Expected offence and defence stat columns to be visible')
  }
  expect(defenceBox.x).toBeGreaterThanOrEqual(offenceBox.x)
  await page.getByRole('button', { name: 'Close stats details' }).click()

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
  const initialLevelUp = page.getByRole('dialog', { name: /level \d+/i })
  for (let choiceIndex = 0; choiceIndex < 5; choiceIndex += 1) {
    if (await overlay.isVisible()) {
      break
    }
    if (await initialLevelUp.isVisible()) {
      await page.keyboard.press('5')
    }
  }
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
  const canvas = page.locator('.game-canvas')
  for (let choiceIndex = 0; choiceIndex < 5; choiceIndex += 1) {
    if (await canvas.getAttribute('data-game-phase') !== 'level-up') {
      break
    }
    await page.keyboard.press('5')
    await expect.poll(
      () => canvas.getAttribute('data-game-phase'),
      { timeout: 2_000 },
    ).toMatch(/playing|level-up/)
  }
  await expect(canvas).toHaveAttribute('data-game-phase', 'playing', {
    timeout: 5_000,
  })
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
  await expect(page.getByRole('heading', { name: 'Victory' })).toBeVisible({
    timeout: 15_000,
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

  // The profiles sit behind a toggle now rather than as a permanent row of
  // buttons, so the test opens the menu the way a player does.
  const behaviorToggle = page.getByRole('button', { name: /Movement behavior:/i })
  await expect(behaviorToggle).toBeVisible()
  await behaviorToggle.click()
  const cautious = page.getByRole('menuitemradio', { name: /Cautious:/i })
  await expect(cautious).toBeVisible()
  await cautious.click()
  // Choosing closes the menu, so the profile is read back off the toggle,
  // which is where a player sees it too.
  await expect(behaviorToggle).toHaveAttribute(
    'aria-label',
    /Movement behavior: Cautious\. Intent: /i,
  )
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
    /playing|level-up/,
    { timeout: 1_000 },
  )
})

test('shows starting level-up choices without requiring Escape', async ({
  page,
}) => {
  await page.goto('/?demo=starting-level-up')
  await signIn(page)
  await openRunSetup(page)
  await startRun(page)

  const canvas = page.locator('.game-canvas')
  await expect(canvas).toHaveAttribute('data-game-phase', 'level-up')
  const overlay = page.getByRole('dialog', { name: /level 2/i })
  await expect(overlay).toBeVisible()
  await expect(page.getByRole('dialog', { name: 'Pause menu' })).toHaveCount(0)

  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog', { name: 'Pause menu' })).toBeVisible()
  await page.getByRole('button', { name: 'Resume run' }).click()
  await expect(overlay).toBeVisible()
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
    /playing|level-up/,
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
  const initialLevelUp = page.getByRole('dialog', { name: /level \d+/i })
  for (let choiceIndex = 0; choiceIndex < 5; choiceIndex += 1) {
    if (await overlay.isVisible()) {
      break
    }
    if (await initialLevelUp.isVisible()) {
      await page.keyboard.press('5')
    }
  }
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

  // The loadout is reference rather than status, so it opens from the toolbar.
  await page.getByRole('button', { name: 'Loadout details', exact: true }).click()
  const loadout = page.getByRole('region', { name: 'Loadout' })
  await expect(loadout.locator('.loadout-item')).toHaveCount(6)
  const equippedItems = loadout.locator('.loadout-item:not(:has(.loadout-empty))')
  await expect(equippedItems).not.toHaveCount(0)
  await equippedItems.last().focus()
  await expect(loadout.locator('.loadout-tooltip')).toBeVisible()
  // Left open, the sheet swallows the Escape the cleanup helper uses to pause.
  await page.getByRole('button', { name: 'Close loadout details' }).click()
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
  await expect(canvas).toHaveAttribute('data-game-phase', /playing|level-up/, {
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
