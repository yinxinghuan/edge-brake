import playwright from '/Users/yin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'

const { chromium } = playwright
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:4173/'
const browser = await chromium.launch({ headless: true })
const errors = []

async function pageForTest() {
  const page = await browser.newPage({ viewport: { width: 390, height: 700 } })
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.addInitScript(() => { Math.random = () => 0 })
  await page.goto(baseUrl, { waitUntil: 'networkidle' })
  await page.waitForSelector('.eb[data-phase="cover"]')
  return page
}

async function hold(page, milliseconds) {
  const box = await page.locator('.eb').boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.72)
  await page.mouse.down()
  await page.waitForTimeout(milliseconds)
  await page.mouse.up()
}

async function state(page) {
  return page.locator('.eb').evaluate(element => ({
    phase: element.dataset.phase,
    x: Number(element.dataset.x),
    level: Number(element.dataset.level),
    character: element.dataset.character,
  }))
}

const passPage = await pageForTest()
await hold(passPage, 1320)
await passPage.waitForSelector('.eb[data-phase="result"]', { timeout: 12000 })
const passResult = await state(passPage)
await passPage.locator('.eb-round-result .eb-button').click()
await passPage.waitForTimeout(900)
const afterNext = await state(passPage)
await passPage.close()

const fallPage = await pageForTest()
await hold(fallPage, 1700)
await fallPage.waitForSelector('.eb[data-phase="gameover"]', { timeout: 12000 })
const fallResult = await state(fallPage)
await fallPage.locator('.eb-gameover .eb-button').click()
await fallPage.waitForTimeout(900)
const afterRetry = await state(fallPage)
await fallPage.close()

console.log(JSON.stringify({ passResult, afterNext, fallResult, afterRetry, errors }, null, 2))
if (passResult.phase !== 'result' || afterNext.phase !== 'awaiting' || afterNext.x !== 40) process.exitCode = 1
if (fallResult.phase !== 'gameover' || afterRetry.phase !== 'awaiting' || afterRetry.x !== 40) process.exitCode = 1
if (errors.length) process.exitCode = 1
await browser.close()
