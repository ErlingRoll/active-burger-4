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

test('pauses on Escape without blocking HUD or development controls', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start Run' }).click()

  await page.keyboard.press('Escape')
  await expect(page.locator('.game-canvas')).toHaveAttribute(
    'data-game-phase',
    'paused',
  )
  await expect(page.getByRole('status')).toHaveText('Paused')

  const skill = page.getByRole('button', {
    name: 'Basic Bolt, level 1',
  })
  await skill.focus()
  await expect(page.getByRole('tooltip')).toContainText('Basic Bolt')

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
})

test('shows an accessible acquired-skill tooltip with a DPS assumption', async ({
  page,
}) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Start Run' }).click()

  const skill = page.getByRole('button', {
    name: 'Basic Bolt, level 1',
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

test('shows rarity-driven gear cards, deltas, and full comparisons', async ({
  page,
}) => {
  await page.goto('/?demo=gear')
  await page.getByRole('button', { name: 'Start Run' }).click()

  const overlay = page.getByRole('dialog', { name: /choose your gear/i })
  await expect(overlay).toBeVisible()
  await expect(
    page.getByRole('button', { name: 'Development Menu' }),
  ).toBeVisible()
  await page.getByRole('button', { name: 'Development Menu' }).click()
  await expect(
    page.getByRole('heading', { name: 'Development Menu' }),
  ).toBeVisible()
  const gearCards = overlay.locator('[data-choice-type="gear"]')
  await expect(gearCards).toHaveCount(3)
  await expect(gearCards.locator('.gear-upgrade-type')).toHaveCount(0)
  await expect(gearCards.first().locator('[data-rarity]')).toBeVisible()
  await expect(gearCards.first()).toContainText(/weapon|helmet|armor|boots|ring|amulet/i)
  await expect(gearCards.first()).toContainText(/gains|net change/i)
  await expect(
    page.getByRole('button', { name: 'Development Menu' }),
  ).toBeFocused()

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
