import playwright from '/Users/yin/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright/index.mjs'
import { mkdir } from 'node:fs/promises'

const { chromium } = playwright
const baseUrl = process.env.BASE_URL || 'http://127.0.0.1:4173/'
const out = new URL('./ui/leaderboard-v1/', import.meta.url).pathname
const expectedSessionId = '5cc524e5-8b5b-48a2-bc0d-e8ecd80fa30a'
await mkdir(out, { recursive: true })
const browser = await chromium.launch({ headless: true })
const errors = []

async function installBridge(page, rowsMode = 'filled') {
  await page.addInitScript(({ mode }) => {
    localStorage.clear()
    localStorage.setItem('game_locale', 'zh')
    Math.random = () => 0
    window.__QA_CALLS = []
    window.__QA_MY_SCORE = 10
    const encode = value => btoa(unescape(encodeURIComponent(JSON.stringify(value))))
    const decode = value => JSON.parse(decodeURIComponent(escape(atob(value))))
    const rows = () => mode === 'empty' ? [] : [
      { user_id: 'champion', score: '300', rank: 1, user_name: '极地船长阿洛', head_url: '' },
      { user_id: 'rival-high', score: '180', rank: 2, user_name: '长名字测试玩家雪原巡逻队', head_url: '' },
      { user_id: 'me', score: String(window.__QA_MY_SCORE), rank: 3, user_name: '我自己', head_url: '' },
      { user_id: 'rival-near', score: '30', rank: 4, user_name: '冰狐', head_url: '' },
    ].sort((a, b) => Number(b.score) - Number(a.score)).map((row, index) => ({ ...row, rank: index + 1 }))

    window.addEventListener('message', event => {
      if (typeof event.data !== 'string') return
      if (event.data.startsWith('AW.PROFILE.OPEN-')) {
        window.__QA_CALLS.push({ kind: 'profile', value: event.data })
        return
      }
      if (!event.data.startsWith('callAPI-')) return
      const payload = decode(event.data.slice('callAPI-'.length))
      window.__QA_CALLS.push({ kind: 'api', url: payload.url, data: payload.data })
      let data = { retcode: 0, msg: '', data: null }
      if (payload.url.includes('/user/get/info/')) data = { retcode: 0, msg: '', data: { telegram_id: 'me', name: '我自己', head_url: '' } }
      if (payload.url.includes('/rank/score/list/')) data = { retcode: 0, msg: '', data: rows() }
      if (payload.url.includes('/rank/score/save')) {
        window.__QA_MY_SCORE = Math.max(window.__QA_MY_SCORE, Number(payload.data?.score) || 0)
      }
      const result = `callAPIResult-${encode({ request_id: payload.request_id, success: true, data })}`
      window.postMessage(result, location.origin)
    })
  }, { mode: rowsMode })
}

async function openRankedPage(width, height, rowsMode = 'filled') {
  const page = await browser.newPage({ viewport: { width, height } })
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error' && !message.text().includes('ERR_NAME_NOT_RESOLVED')) errors.push(message.text()) })
  await installBridge(page, rowsMode)
  const origin = new URL(baseUrl).origin
  const url = `${baseUrl}?api_origin=${encodeURIComponent(origin)}&telegram_id=me`
  await page.goto(url, { waitUntil: 'networkidle' })
  await page.waitForSelector('.eb[data-can-rank="1"]')
  return page
}

async function captureFilled(width, height) {
  const page = await openRankedPage(width, height)
  await page.waitForSelector('.eb-champion-entry--live')
  await page.screenshot({ path: `${out}${width}-01-cover-champion.png` })
  await page.locator('.eb-cover .eb-champion-entry').click()
  await page.waitForSelector('.eb[data-leaderboard="open"] .lb-row')
  await page.screenshot({ path: `${out}${width}-02-board-filled.png` })
  const meDisabled = await page.locator('.lb-row--me').isDisabled()
  await page.locator('.lb-row').filter({ hasText: '长名字测试玩家' }).click()
  const profileCalls = await page.evaluate(() => window.__QA_CALLS.filter(call => call.kind === 'profile').length)
  await page.locator('.lb-close').click()
  await page.waitForSelector('.eb[data-leaderboard="closed"]')

  const game = page.locator('.eb')
  const box = await game.boundingBox()
  await page.mouse.move(box.x + box.width * 0.08, box.y + box.height * 0.5)
  await page.mouse.down(); await page.waitForTimeout(1250); await page.mouse.up()
  await page.waitForSelector('.eb[data-phase="playing"]')
  await page.waitForFunction(() => ['result', 'gameover'].includes(document.querySelector('.eb')?.getAttribute('data-phase') || ''), null, { timeout: 12000 })
  const firstOutcome = await game.getAttribute('data-phase')
  if (firstOutcome !== 'result') throw new Error(`Expected first round result, got ${firstOutcome}`)
  let reachedGameover = false
  for (let attempt = 0; attempt < 6 && !reachedGameover; attempt += 1) {
    await page.locator('.eb-round-result .eb-button').click()
    await page.waitForSelector('.eb[data-phase="awaiting"]')
    await page.waitForTimeout(320)
    const box2 = await game.boundingBox()
    await page.mouse.move(box2.x + box2.width * 0.08, box2.y + box2.height * 0.5)
    await page.mouse.down()
    await page.waitForSelector('.eb[data-phase="charging"]')
    await page.waitForTimeout(1700)
    await page.mouse.up()
    await page.waitForSelector('.eb[data-phase="playing"]')
    await page.waitForFunction(() => ['result', 'gameover'].includes(document.querySelector('.eb')?.getAttribute('data-phase') || ''), null, { timeout: 12000 })
    reachedGameover = await game.getAttribute('data-phase') === 'gameover'
  }
  if (!reachedGameover) throw new Error('Expected a full-charge run to reach gameover within six rounds')
  await page.waitForTimeout(350)
  await page.screenshot({ path: `${out}${width}-03-gameover-champion.png` })
  const calls = await page.evaluate(() => window.__QA_CALLS)
  const rankList = calls.find(call => call.url?.includes('/rank/score/list/'))
  const scoreSave = calls.find(call => call.url?.includes('/rank/score/save'))
  const notifyCall = calls.find(call => call.url?.includes('/record/play'))
  const notifyConfig = notifyCall?.data?.config_json ? JSON.parse(notifyCall.data.config_json) : null
  await page.close()
  return {
    meDisabled,
    profileCalls,
    score: scoreSave?.data?.score,
    notifyConfig,
    sessionOkay: rankList?.url?.includes(expectedSessionId)
      && scoreSave?.data?.session_id === expectedSessionId
      && notifyCall?.data?.session_id === expectedSessionId,
  }
}

const full = await captureFilled(390, 700)
const compact = await captureFilled(320, 568)

const emptyPage = await openRankedPage(390, 700, 'empty')
await emptyPage.waitForSelector('.eb-champion-entry:not(.eb-champion-entry--live)')
await emptyPage.locator('.eb-cover .eb-champion-entry').click()
await emptyPage.waitForSelector('.lb-state')
await emptyPage.screenshot({ path: `${out}390-04-board-empty.png` })
await emptyPage.close()

const standalone = await browser.newPage({ viewport: { width: 390, height: 700 } })
await standalone.addInitScript(() => { localStorage.clear(); localStorage.setItem('game_locale', 'zh') })
await standalone.goto(baseUrl, { waitUntil: 'networkidle' })
await standalone.waitForSelector('.eb[data-can-rank="0"]')
const standaloneEntryCount = await standalone.locator('.eb-champion-entry').count()
await standalone.screenshot({ path: `${out}390-05-standalone-gated.png` })
await standalone.close()

console.log(JSON.stringify({ full, compact, standaloneEntryCount, errors }, null, 2))
for (const result of [full, compact]) {
  const actions = result.notifyConfig?.actions || []
  if (!result.meDisabled || result.profileCalls !== 1 || !(result.score > 30) || !result.sessionOkay) process.exitCode = 1
  if (actions.length !== 1 || actions[0].target_user_id !== 'rival-near' || actions[0].type !== 'notify') process.exitCode = 1
}
if (standaloneEntryCount !== 0 || errors.length) process.exitCode = 1
await browser.close()
