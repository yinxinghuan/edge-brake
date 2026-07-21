import playwright from '/Users/yin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import { mkdir } from 'node:fs/promises'

const { chromium } = playwright
const out = new URL('./ui/auto-brake-v1/', import.meta.url).pathname
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true })
const errors = []

async function run(width, height) {
  const page = await browser.newPage({ viewport: { width, height } })
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })
  await page.waitForSelector('.eb[data-phase="cover"]')
  const box = await page.locator('.eb').boundingBox()
  await page.mouse.move(box.x + box.width / 2, box.y + box.height * 0.72)
  await page.mouse.down()
  await page.waitForTimeout(1250)
  await page.mouse.up()

  await page.waitForTimeout(1300)
  const eggAtOverview = await page.locator('canvas').getAttribute('data-distant-easter-egg')
  await page.screenshot({ path: `${out}${width}-01-full-overview-egg.png` })

  await page.waitForSelector('.eb[data-auto-braking="1"]', { timeout: 9000 })
  const onset = await page.locator('.eb').evaluate(element => ({
    x: Number(element.dataset.x),
    velocity: Number(element.dataset.velocity),
    progress: Number(element.dataset.trackProgress),
  }))
  await page.screenshot({ path: `${out}${width}-02-auto-brake-onset.png` })
  await page.waitForTimeout(420)
  await page.screenshot({ path: `${out}${width}-03-auto-brake-hold.png` })
  await page.waitForSelector('.eb[data-phase="result"]', { timeout: 9000 })
  await page.screenshot({ path: `${out}${width}-04-result.png` })
  await page.close()
  return { eggAtOverview, onset }
}

const full = await run(390, 700)
const compact = await run(320, 568)

const overshootPage = await browser.newPage({ viewport: { width: 390, height: 700 } })
overshootPage.on('pageerror', error => errors.push(error.message))
await overshootPage.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })
const overshootBox = await overshootPage.locator('.eb').boundingBox()
await overshootPage.mouse.move(overshootBox.x + overshootBox.width / 2, overshootBox.y + overshootBox.height * 0.72)
await overshootPage.mouse.down()
await overshootPage.waitForTimeout(1700)
await overshootPage.mouse.up()
await overshootPage.waitForSelector('.eb[data-auto-braking="1"]', { timeout: 9000 })
const overshootBrake = await overshootPage.locator('.eb').evaluate(element => ({
  x: Number(element.dataset.x),
  velocity: Number(element.dataset.velocity),
  cliff: Number(element.dataset.cliff),
}))
await overshootPage.screenshot({ path: `${out}390-05-overshoot-brake.png` })
await overshootPage.waitForSelector('.eb[data-phase="gameover"]', { timeout: 9000 })
await overshootPage.close()

console.log(JSON.stringify({ full, compact, overshootBrake, errors }, null, 2))
if (!full.eggAtOverview || !compact.eggAtOverview || !overshootBrake || errors.length) process.exitCode = 1
await browser.close()
