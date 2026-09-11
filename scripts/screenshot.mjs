#!/usr/bin/env node
/*
 * Look at the running application.
 *
 * This is the routine way to check a change: start the dev server if it is not
 * already up, sign in as the test account, and photograph a screen at the two
 * viewports that matter. It is seconds rather than the minutes an end-to-end
 * run costs, and looking at the screen catches what an assertion does not.
 *
 * The Playwright specs under e2e/ are not this. They are run when they are
 * asked for, not as a matter of course.
 *
 *   node scripts/screenshot.mjs --path /wiki
 *   node scripts/screenshot.mjs --path /store --size desktop
 *   node scripts/screenshot.mjs --run --out shots
 *
 * Options:
 *   --path <route>   Screen to open. Default "/".
 *   --size <which>   "phone", "desktop" or "both". Default "both".
 *   --run            Enter the dungeon: resume the active run, or start one.
 *   --devmenu        With --run: open the in-run development menu before the shot.
 *   --wait <ms>      Settle time after the screen renders. Default 1500.
 *   --out <dir>      Where the images land. Default the scratchpad, else "."
 *   --anon           Skip signing in.
 *   --full           Capture the whole scrolled page, not only the first screenful.
 *   --scroll-end     Scroll the page and every inner scroll container to the bottom first.
 */

import { spawn } from 'node:child_process'
import { mkdir } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { chromium, devices } from '@playwright/test'
import { loadEnv } from 'vite'

const BASE_URL = 'http://127.0.0.1:3000'

/*
 * The two sizes Erling reads the game at. A phone at the default iPhone
 * viewport and a desktop at Full HD; the sizes in between are the end-to-end
 * matrix's business, not this script's.
 */
const VIEWPORTS = {
  phone: { ...devices['iPhone 13'].viewport, label: 'phone-390x844' },
  desktop: { width: 1920, height: 1080, label: 'desktop-1920x1080' },
}

function readOptions(argv) {
  const options = {
    path: '/',
    size: 'both',
    run: false,
    devmenu: false,
    wait: 1500,
    out: process.env.CLAUDE_SCRATCHPAD_DIR ?? '.',
    anon: false,
    full: false,
    scrollEnd: false,
  }
  for (let index = 0; index < argv.length; index += 1) {
    const flag = argv[index]
    const value = argv[index + 1]
    if (flag === '--path') { options.path = value; index += 1 }
    else if (flag === '--size') { options.size = value; index += 1 }
    else if (flag === '--wait') { options.wait = Number(value); index += 1 }
    else if (flag === '--out') { options.out = value; index += 1 }
    else if (flag === '--run') { options.run = true }
    else if (flag === '--devmenu') { options.devmenu = true }
    else if (flag === '--anon') { options.anon = true }
    else if (flag === '--full') { options.full = true }
    else if (flag === '--scroll-end') { options.scrollEnd = true }
    else { throw new Error(`Unknown option: ${flag}`) }
  }
  if (!['phone', 'desktop', 'both'].includes(options.size)) {
    throw new Error(`--size must be phone, desktop or both, not ${options.size}`)
  }
  /*
   * Git Bash rewrites a leading slash into a Windows path before the argument
   * reaches Node, so "/wiki" arrives as "C:/Program Files/Git/wiki". Say so
   * rather than navigating to the wreckage, and accept the slashless form.
   */
  if (/[:\\]/.test(options.path)) {
    throw new Error(
      `--path looks like a filesystem path: ${options.path}. `
      + 'A POSIX shell on Windows rewrites a leading slash. Pass it without '
      + 'one, as --path wiki.',
    )
  }
  if (!options.path.startsWith('/')) {
    options.path = `/${options.path}`
  }
  return options
}

async function serverIsListening() {
  try {
    const response = await fetch(BASE_URL, { signal: AbortSignal.timeout(1500) })
    return response.ok
  } catch {
    return false
  }
}

/**
 * Reuses a dev server the human already has running, which is the common case
 * and the fast one. A server this script starts is stopped again on the way
 * out; one it found is left alone.
 */
async function ensureServer() {
  if (await serverIsListening()) {
    return null
  }
  const child = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1'], {
    stdio: 'ignore',
    shell: process.platform === 'win32',
  })
  const deadline = Date.now() + 60_000
  while (Date.now() < deadline) {
    if (await serverIsListening()) {
      return child
    }
    await new Promise((resolve) => setTimeout(resolve, 400))
  }
  child.kill()
  throw new Error('The dev server did not start within a minute.')
}

async function signIn(page) {
  const environment = loadEnv('development', process.cwd(), 'VITE_')
  const email = environment.VITE_TEST_USER_EMAIL
  const password = environment.VITE_TEST_USER_PASSWORD
  if (!email || !password) {
    throw new Error(
      'Set VITE_TEST_USER_EMAIL and VITE_TEST_USER_PASSWORD in .env.development, or pass --anon.',
    )
  }
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password').fill(password)
  await page.getByLabel('Keep me signed in on this browser').check()
  await page.getByRole('button', { name: 'Sign in' }).click()
  /*
   * Wait for the refuge, not for the account block.
   *
   * This used to wait for the Sign out button, which a phone keeps inside the
   * collapsed header menu: the sign-in succeeded and the wait timed out
   * anyway, so no phone screenshot could be taken at all. The dashboard's own
   * root is present at every width.
   */
  await page.locator('.game-dashboard')
    .waitFor({ state: 'visible', timeout: 30_000 })
  await skipNicknamePrompt(page)
}

/*
 * A test account that has never asked for a nickname is prompted for one on
 * arrival, over the very screen the shot is of. The shell says whether that
 * prompt is still to come, so this waits for the answer rather than guessing.
 */
async function skipNicknamePrompt(page) {
  const shell = page.locator('.app-shell[data-nickname-prompt="open"], .app-shell[data-nickname-prompt="closed"]')
  await shell.waitFor({ state: 'attached', timeout: 20_000 })
  if (await shell.getAttribute('data-nickname-prompt') === 'open') {
    await page.getByRole('button', { name: 'Skip for now' }).click()
    await page.locator('.app-shell[data-nickname-prompt="closed"]')
      .waitFor({ state: 'attached', timeout: 10_000 })
  }
}

/**
 * Into the arena, by whichever door is open: a saved run is resumed, and
 * otherwise a fresh one is prepared and started. Level-up choices are taken
 * blind so the shot is of the HUD rather than of an overlay.
 */
async function enterRun(page) {
  const canvas = page.locator('.game-canvas')
  if (await canvas.count() === 0) {
    /*
     * The dashboard knows whether a run is waiting only once it has asked the
     * server, so wait for the answer rather than for a button that has not
     * been rendered yet.
     */
    await page.locator('.game-dashboard[data-run-persistence-state]')
      .waitFor({ state: 'attached', timeout: 30_000 })
    const resume = page.getByRole('button', { name: /Resume dungeon|Resume run/i })
    const resumable = await resume.first()
      .waitFor({ state: 'visible', timeout: 10_000 })
      .then(() => true, () => false)
    if (resumable) {
      await resume.first().click()
    } else {
      await page.goto(`${BASE_URL}/prepare/dungeon`)
      await page.locator('.run-setup').waitFor({ state: 'visible', timeout: 30_000 })
      await page.getByRole('button', { name: 'Start Run' }).first().click()
    }
  }
  await canvas.waitFor({ state: 'visible', timeout: 30_000 })
  for (let attempt = 0; attempt < 6; attempt += 1) {
    if (await canvas.getAttribute('data-game-phase') !== 'level-up') {
      break
    }
    await page.keyboard.press('5')
    await page.waitForTimeout(300)
  }
}

async function capture(browser, options, viewport, outputDirectory) {
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.label.startsWith('phone'),
    hasTouch: viewport.label.startsWith('phone'),
    baseURL: BASE_URL,
  })
  const page = await context.newPage()
  const problems = []
  page.on('console', (message) => {
    if (message.type() === 'error') {
      problems.push(message.text())
    }
  })
  page.on('pageerror', (error) => problems.push(String(error)))

  await page.goto(BASE_URL)
  if (!options.anon) {
    await signIn(page)
  }
  if (options.run) {
    await enterRun(page)
    if (options.devmenu) {
      // The backquote toggles the development menu wherever the tools are on.
      await page.keyboard.press("Backquote")
    }
  } else if (options.path !== '/') {
    await page.goto(`${BASE_URL}${options.path}`)
  }
  await page.waitForTimeout(options.wait)
  if (options.scrollEnd) {
    // The foot of a screen is where a phone hides things, and a phone screen
    // often scrolls in a sheet rather than in the window.
    await page.evaluate(() => {
      window.scrollTo(0, document.documentElement.scrollHeight)
      for (const element of document.querySelectorAll('*')) {
        const { overflowY } = getComputedStyle(element)
        if ((overflowY === 'auto' || overflowY === 'scroll') && element.scrollHeight > element.clientHeight) {
          element.scrollTop = element.scrollHeight
        }
      }
    })
    await page.waitForTimeout(300)
  }

  const file = path.join(outputDirectory, `${viewport.label}.png`)
  await page.screenshot({ path: file, fullPage: options.full })
  await context.close()
  return { file, problems }
}

async function main() {
  const options = readOptions(process.argv.slice(2))
  const outputDirectory = path.resolve(options.out)
  await mkdir(outputDirectory, { recursive: true })

  const startedServer = await ensureServer()
  const browser = await chromium.launch()
  try {
    const wanted = options.size === 'both'
      ? ['phone', 'desktop']
      : [options.size]
    for (const name of wanted) {
      const { file, problems } = await capture(
        browser, options, VIEWPORTS[name], outputDirectory,
      )
      console.log(file)
      for (const problem of new Set(problems)) {
        console.log(`  console error: ${problem}`)
      }
    }
  } finally {
    await browser.close()
    startedServer?.kill()
  }
}

await main()
