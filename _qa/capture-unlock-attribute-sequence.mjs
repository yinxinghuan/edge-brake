import playwright from '/Users/yin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import { mkdir } from 'node:fs/promises'

const { chromium } = playwright
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:4173/'
const out = new URL('./ui/unlock-attribute-sequence-v1/', import.meta.url).pathname
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true })
const errors = []

async function openGame(width, height) {
  const page = await browser.newPage({ viewport: { width, height } })
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.addInitScript(() => {
    localStorage.clear()
    localStorage.setItem('game_locale', 'zh')
    Math.random = () => 0
  })
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.waitForSelector('.eb[data-phase="cover"]')
  return page
}

async function hold(page, milliseconds, keepDown = false) {
  const box = await page.locator('.eb').boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.72)
  await page.mouse.down()
  await page.waitForTimeout(milliseconds)
  if (!keepDown) await page.mouse.up()
}

async function reachUnlock(page) {
  await hold(page, 1320)
  await page.waitForSelector('.eb[data-phase="result"]', { timeout: 12000 })
  await page.locator('.eb-round-result .eb-button').click()
  await page.waitForSelector('.eb[data-phase="awaiting"][data-new-unlock="granny"][data-character-stats="delayed"]')
}

async function run(width, height) {
  const page = await openGame(width, height)
  await reachUnlock(page)
  await page.waitForTimeout(320)
  const during = {
    unlocks: await page.locator('.eb-unlock-toast').count(),
    stats: await page.locator('.eb-character-stats').count(),
    state: await page.locator('.eb').getAttribute('data-character-stats'),
  }
  await page.screenshot({ path: `${out}${width}-01-unlock-only.png` })

  await page.waitForSelector('.eb[data-new-unlock=""][data-character-stats="visible"]', { timeout: 3000 })
  await page.waitForTimeout(260)
  const stats = page.locator('.eb-character-stats')
  const after = {
    unlocks: await page.locator('.eb-unlock-toast').count(),
    stats: await stats.count(),
    text: await stats.innerText(),
    strongNames: await stats.locator('strong').count(),
    numberSize: await stats.locator('b').first().evaluate(element => getComputedStyle(element).fontSize),
  }
  await page.screenshot({ path: `${out}${width}-02-attributes-after.png` })
  await page.close()
  return { during, after }
}

const full = await run(390, 700)
const compact = await run(320, 568)

const earlyPage = await openGame(390, 700)
await reachUnlock(earlyPage)
await earlyPage.waitForTimeout(320)
await hold(earlyPage, 260, true)
await earlyPage.waitForSelector('.eb[data-phase="charging"][data-new-unlock=""][data-character-stats="visible"]')
const earlyInput = {
  unlocks: await earlyPage.locator('.eb-unlock-toast').count(),
  stats: await earlyPage.locator('.eb-character-stats').count(),
}
await earlyPage.screenshot({ path: `${out}390-03-early-input-handoff.png` })
await earlyPage.mouse.up()
await earlyPage.close()

console.log(JSON.stringify({ full, compact, earlyInput, errors }, null, 2))
for (const result of [full, compact]) {
  if (result.during.unlocks !== 1 || result.during.stats !== 0 || result.during.state !== 'delayed') process.exitCode = 1
  if (result.after.unlocks !== 0 || result.after.stats !== 1 || result.after.strongNames !== 0 || result.after.numberSize !== '21px') process.exitCode = 1
}
if (earlyInput.unlocks !== 0 || earlyInput.stats !== 1 || errors.length) process.exitCode = 1
await browser.close()
