import playwright from '/Users/yin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import { mkdir } from 'node:fs/promises'

const out = new URL('./ui/cover-layout-fix/', import.meta.url).pathname
await mkdir(out, { recursive: true })

const browser = await playwright.chromium.launch({ headless: true })
const results = []

async function capture(width, height, state, emulateBrokenLayout = false, hideGuestBanner = true) {
  const page = await browser.newPage({ viewport: { width, height } })
  const errors = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => {
    if (message.type() === 'error') errors.push(message.text())
  })
  await page.goto('http://127.0.0.1:4173/', { waitUntil: 'networkidle' })
  if (hideGuestBanner) await page.addStyleTag({ content: '#alteru-guest-banner{display:none!important}' })
  if (emulateBrokenLayout) {
    await page.addStyleTag({
      content: '.eb-cover{padding-top:104px}.eb-cover__scene-space{height:220px}.eb-weather-brief--compact{animation-name:eb-weather-in}',
    })
  }
  await page.waitForSelector('.eb[data-phase="cover"]')
  await page.waitForTimeout(450)

  const boxes = await page.evaluate(() => {
    const selectors = ['.eb-cover__eyebrow', 'h1', 'p', '.eb-weather-brief', '.eb-cover__scene-space', '.eb-cover__entries', '.eb-charge']
    return Object.fromEntries(selectors.map(selector => {
      const node = document.querySelector(selector)
      if (!node) return [selector, null]
      const rect = node.getBoundingClientRect()
      return [selector, { left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height }]
    }))
  })
  const weather = boxes['.eb-weather-brief']
  const entries = boxes['.eb-cover__entries']
  const charge = boxes['.eb-charge']
  const checks = {
    weatherInsideViewport: Boolean(weather && weather.left >= 0 && weather.right <= width),
    entriesClearCharge: Boolean(entries && charge && entries.bottom <= charge.top),
  }
  await page.screenshot({ path: `${out}${state}-${width}x${height}.png` })
  results.push({ state, width, height, boxes, checks, errors })
  await page.close()
}

for (const [width, height] of [[390, 844], [390, 700], [320, 568]]) {
  await capture(width, height, 'platform-layout-cover-firstpass', true)
  await capture(width, height, 'platform-layout-cover-recheck')
}

await capture(390, 700, 'external-guest-cover-recheck', false, false)

console.log(JSON.stringify(results, null, 2))
if (results.some(result => result.state.includes('recheck') && (!result.checks.weatherInsideViewport || !result.checks.entriesClearCharge))) process.exitCode = 1
await browser.close()
