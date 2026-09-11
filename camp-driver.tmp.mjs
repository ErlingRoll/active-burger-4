// Drives the Camp panel on the hub against a running dev server and photographs it.
//   node camp-driver.mjs <baseUrl> <email> <password> <outDir>
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import { chromium, devices } from '@playwright/test'

const [baseUrl, email, password, outDir] = process.argv.slice(2)
const VIEWPORTS = {
  phone: { ...devices['iPhone 13'].viewport, label: 'phone-390x844' },
  desktop: { width: 1920, height: 1080, label: 'desktop-1920x1080' },
}

async function scrollReport(page) {
  return page.evaluate(() => {
    const doc = document.documentElement
    const findings = []
    if (doc.scrollHeight > doc.clientHeight + 1) findings.push(`document scrolls ${doc.scrollHeight} > ${doc.clientHeight}`)
    if (doc.scrollWidth > doc.clientWidth + 1) findings.push(`document scrolls sideways ${doc.scrollWidth} > ${doc.clientWidth}`)
    for (const el of document.querySelectorAll('*')) {
      const style = getComputedStyle(el)
      if ((style.overflowY === 'auto' || style.overflowY === 'scroll') && el.scrollHeight > el.clientHeight + 1) {
        findings.push(`${el.className || el.tagName} scrolls ${el.scrollHeight} > ${el.clientHeight}`)
      }
    }
    return findings
  })
}

async function run(browser, viewport) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.label.startsWith('phone'),
    hasTouch: viewport.label.startsWith('phone'),
  })
  const page = await context.newPage()
  const problems = []
  page.on('console', (m) => { if (m.type() === 'error') problems.push(m.text()) })
  page.on('pageerror', (e) => problems.push(String(e)))

  await page.goto(baseUrl)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByRole('button', { name: 'Sign in' }).click()
  await page.locator('.game-dashboard[data-run-persistence-state="ready"]').waitFor({ state: 'attached', timeout: 30_000 })

  const shot = async (name) => {
    await page.waitForTimeout(800)
    const file = path.join(outDir, `${viewport.label}-${name}.png`)
    await page.screenshot({ path: file, fullPage: false })
    const report = viewport.label.startsWith('desktop') ? await scrollReport(page) : []
    console.log(`${file}${report.length ? `\n  SCROLL: ${report.join('; ')}` : ''}`)
  }

  await page.getByRole('button', { name: /The Camp/ }).click()
  await page.locator('.hub-camp-panel').waitFor({ state: 'visible', timeout: 15_000 })
  await page.waitForTimeout(3000)
  console.log('PANEL TEXT:', (await page.locator('.hub-camp-panel').innerText()).split('\n').join(' | '))
  await page.locator('.camp-jobs').waitFor({ state: 'visible', timeout: 15_000 })
  if (viewport.label.startsWith('phone')) {
    await page.locator('.hub-camp-panel').scrollIntoViewIfNeeded()
  }
  await shot('1-panel')

  for (const name of ['Build the tackle bench', 'Build the rift anchor', 'Build the smokehouse', 'Build the forge']) {
    const build = page.getByRole('button', { name })
    if (await build.count() > 0 && await build.isEnabled()) {
      await build.click()
      await page.waitForTimeout(1200)
    }
  }
  await shot('1b-built')
  const sendButtons = page.getByRole('button', { name: 'Send a Champion' })
  if (await sendButtons.count() >= 3) {
    await sendButtons.nth(2).click()
    await page.locator('.camp-picker').waitFor({ state: 'visible' })
    await shot('1c-anchor-picker')
    const rest = page.locator('.camp-picker-option').first()
    if (await rest.count() > 0) {
      await rest.click()
      await page.waitForTimeout(1500)
      await shot('1d-resting')
    } else {
      await page.getByRole('button', { name: 'Cancel' }).click()
    }
  }
  const reforgeButton = page.getByRole('button', { name: 'Reforge an artifact' })
  if (await reforgeButton.count() > 0) {
    await reforgeButton.click()
    await page.locator('.camp-picker').waitFor({ state: 'visible' })
    await page.waitForTimeout(800)
    await shot('1h-forge-picker')
    const relic = page.getByRole('button', { name: /^Reforge Ember Reliquary/ })
    if (await relic.count() > 0 && await relic.isEnabled()) {
      await relic.click()
      await page.waitForTimeout(1500)
      await shot('1i-reforged')
    } else {
      await page.getByRole('button', { name: 'Cancel' }).click()
    }
  }
  const gutButton = page.getByRole('button', { name: 'Gut a fish' })
  if (await gutButton.count() > 0) {
    await gutButton.click()
    await page.locator('.camp-picker').waitFor({ state: 'visible' })
    await page.waitForTimeout(800)
    await shot('1e-gut-picker')
    await page.getByRole('button', { name: 'Cancel' }).click()
    await page.getByRole('button', { name: 'Cure a fish' }).click()
    await page.locator('.camp-picker').waitFor({ state: 'visible' })
    await page.waitForTimeout(800)
    await shot('1f-cure-picker')
    const cure = page.getByRole('button', { name: /^Cure Silver Perch/ })
    if (await cure.isEnabled()) {
      await cure.click()
      await page.waitForTimeout(1500)
      await shot('1g-cured')
    } else {
      await page.getByRole('button', { name: 'Cancel' }).click()
    }
  }

  const send = page.getByRole('button', { name: 'Send a Champion' }).first()
  if (await send.count() > 0) {
    await send.click()
    await page.locator('.camp-picker').waitFor({ state: 'visible' })
    await shot('2-picker')
    await page.locator('.camp-picker-option').first().click()
    await page.locator('.camp-worker').first().waitFor({ state: 'visible', timeout: 15_000 })
    await shot('3-assigned')
  }
  const claim = page.getByRole('button', { name: /^Claim/ })
  if (await claim.isEnabled()) {
    await claim.click()
    await page.waitForTimeout(1500)
    await shot('4-claimed')
  }
  const recall = page.getByRole('button', { name: 'Bring back' }).first()
  if (await recall.count() > 0) {
    await recall.click()
    await page.waitForTimeout(1500)
    await shot('5-recalled')
  }
  console.log(`problems: ${problems.length === 0 ? 'none' : problems.join('\n  ')}`)
  await context.close()
}

await mkdir(outDir, { recursive: true })
const browser = await chromium.launch()
try {
  for (const name of ['desktop', 'phone']) {
    await run(browser, VIEWPORTS[name])
  }
} finally {
  await browser.close()
}
