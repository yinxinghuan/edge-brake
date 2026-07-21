import playwright from '/Users/yin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import { mkdir } from 'node:fs/promises'

const { chromium } = playwright
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:4173/'
const out = new URL('./ui/motion-timing-v1/', import.meta.url).pathname
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true })
const errors = []

async function run(width, height) {
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
  const box = await page.locator('.eb').boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.72)
  await page.mouse.down()
  await page.waitForTimeout(1320)
  await page.mouse.up()

  await page.waitForTimeout(120)
  await page.screenshot({ path: `${out}${width}-01-run-burst-120ms.png` })
  await page.waitForTimeout(250)
  await page.screenshot({ path: `${out}${width}-02-glide-370ms.png` })

  await page.waitForSelector('.eb[data-auto-braking="1"]', { timeout: 9000 })
  const brakeStartedAt = performance.now()
  const onset = await page.locator('.eb').evaluate(element => ({
    x: Number(element.dataset.x),
    velocity: Number(element.dataset.velocity),
    progress: Number(element.dataset.trackProgress),
  }))
  await page.screenshot({ path: `${out}${width}-03-brake-onset.png` })
  await page.waitForTimeout(700)
  const holding = await page.locator('.eb').getAttribute('data-auto-braking')
  await page.screenshot({ path: `${out}${width}-04-brake-hold-700ms.png` })
  await page.waitForSelector('.eb[data-phase="success"], .eb[data-phase="earlyFail"], .eb[data-phase="falling"]', { timeout: 9000 })
  const brakeDurationMs = Math.round(performance.now() - brakeStartedAt)
  await page.waitForSelector('.eb[data-phase="result"], .eb[data-phase="gameover"]', { timeout: 9000 })
  await page.screenshot({ path: `${out}${width}-05-result.png` })
  await page.close()
  return { onset, holding, brakeDurationMs }
}

const full = await run(390, 700)
const compact = await run(320, 568)
console.log(JSON.stringify({ full, compact, errors }, null, 2))
for (const result of [full, compact]) {
  if (result.holding !== '1' || result.brakeDurationMs < 1700) process.exitCode = 1
}
if (errors.length) process.exitCode = 1
await browser.close()
