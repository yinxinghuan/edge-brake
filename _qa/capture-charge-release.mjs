import playwright from '/Users/yin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import { mkdir } from 'node:fs/promises'

const { chromium } = playwright

const out = new URL('./ui/charge-release-v3/', import.meta.url).pathname
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true })

async function openGame(width, height) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 })
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })
  await page.waitForSelector('.eb[data-phase="cover"]')
  await page.waitForTimeout(900)
  return page
}

async function gameState(page) {
  return page.locator('.eb').evaluate(el => ({
    phase: el.dataset.phase,
    x: Number(el.dataset.x),
    velocity: Number(el.dataset.velocity),
    cliff: Number(el.dataset.cliff),
    charge: Number(el.dataset.charge),
    progress: Number(el.dataset.trackProgress),
  }))
}

async function holdAndRelease(page, holdMs, prefix, captureFrames = false) {
  const game = page.locator('.eb')
  const box = await game.boundingBox()
  const point = { x: box.x + box.width / 2, y: box.y + box.height * 0.72 }
  await page.mouse.move(point.x, point.y)
  await page.mouse.down()
  await page.waitForTimeout(Math.min(800, holdMs))
  if (captureFrames) await page.screenshot({ path: `${out}${prefix}-02-charge-mid.png` })
  if (holdMs > 800) await page.waitForTimeout(holdMs - 800)
  if (captureFrames) await page.screenshot({ path: `${out}${prefix}-03-charge-release.png` })
  const charged = await gameState(page)
  await page.mouse.up()
  if (captureFrames) {
    await page.waitForTimeout(160)
    await page.screenshot({ path: `${out}${prefix}-04-launch.png` })
    await page.waitForTimeout(1040)
    await page.screenshot({ path: `${out}${prefix}-05-overview.png` })
  }
  await page.waitForFunction(() => ['result', 'gameover'].includes(document.querySelector('.eb')?.dataset.phase ?? ''), null, { timeout: 12000 })
  const result = await gameState(page)
  if (captureFrames) await page.screenshot({ path: `${out}${prefix}-06-result.png` })
  return { charged, result }
}

const main = await openGame(390, 700)
await main.screenshot({ path: `${out}390-01-cover.png` })
const mainResult = await holdAndRelease(main, 1050, '390', true)
await main.close()

const compact = await openGame(320, 568)
await compact.screenshot({ path: `${out}320-01-cover.png` })
const compactResult = await holdAndRelease(compact, 1050, '320', true)
await compact.close()

console.log(JSON.stringify({ mainResult, compactResult }, null, 2))
await browser.close()
