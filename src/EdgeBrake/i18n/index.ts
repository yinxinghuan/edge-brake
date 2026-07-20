export type Locale = 'zh' | 'en'

const zh = {
  title: '急刹车',
  subtitle: '看准时机，一击急停',
  start: '开始滑行',
  hold: '点一下急停',
  release: '制动中…',
  ready: '准备——',
  level: '关卡',
  score: '分数',
  coins: '金币',
  runCoins: '本局金币',
  combo: '贴边',
  edge: '贴边！',
  great: '漂亮！',
  safe: '安全停住',
  early: '太早啦',
  distance: '距边缘 {n}px',
  fallen: '滑过头了！',
  resultTitle: '冰面事故报告',
  passed: '通过关卡',
  bestDistance: '最近停车',
  bestCombo: '最高贴边',
  bestScore: '历史最高',
  again: '再来一次',
  home: '返回封面',
  soundOn: '开启声音',
  soundOff: '关闭声音',
  unitRounds: '关',
  none: '—',
  expedition: '远征队',
  expeditionNote: '体型不同，抓地力也不同',
  unlocked: '新队员解锁',
  friction: '抓地',
  inUse: '使用中',
  owned: '选择',
  buy: '{n} 金币',
  levelUnlock: '到达第 {n} 关解锁',
  notEnough: '还差 {n} 金币',
  close: '关闭远征队',
  cliffDistance: '距断崖',
  weather_clear: '晴朗',
  weather_snow: '飘雪',
  weather_fog: '薄雾',
  weather_blizzard: '风雪',
  char_penguin: '企鹅',
  char_kid: '小孩',
  char_granny: '老奶奶',
  char_businessman: '商务男',
  char_fox: '狐狸',
  char_frog: '青蛙',
  char_bear: '棕熊',
}

const en: typeof zh = {
  title: 'EDGE BRAKE',
  subtitle: 'One tap. Nail the stop.',
  start: 'START SLIDING',
  hold: 'TAP TO BRAKE',
  release: 'BRAKING…',
  ready: 'READY—',
  level: 'LEVEL',
  score: 'SCORE',
  coins: 'COINS',
  runCoins: 'RUN COINS',
  combo: 'EDGE',
  edge: 'ON THE EDGE!',
  great: 'BEAUTIFUL!',
  safe: 'SAFE STOP',
  early: 'TOO EARLY',
  distance: '{n}px TO EDGE',
  fallen: 'TOO FAR!',
  resultTitle: 'ICE INCIDENT REPORT',
  passed: 'LEVELS CLEARED',
  bestDistance: 'CLOSEST STOP',
  bestCombo: 'BEST EDGE STREAK',
  bestScore: 'BEST SCORE',
  again: 'TRY AGAIN',
  home: 'BACK TO COVER',
  soundOn: 'Turn sound on',
  soundOff: 'Turn sound off',
  unitRounds: ' rounds',
  none: '—',
  expedition: 'EXPEDITION CREW',
  expeditionNote: 'Different bodies, different grip',
  unlocked: 'NEW CREW UNLOCKED',
  friction: 'GRIP',
  inUse: 'IN USE',
  owned: 'SELECT',
  buy: '{n} COINS',
  levelUnlock: 'REACH LEVEL {n}',
  notEnough: '{n} COINS SHORT',
  close: 'Close expedition crew',
  cliffDistance: 'TO CLIFF',
  weather_clear: 'CLEAR',
  weather_snow: 'SNOW',
  weather_fog: 'FOG',
  weather_blizzard: 'BLIZZARD',
  char_penguin: 'PENGUIN',
  char_kid: 'KID',
  char_granny: 'GRANNY',
  char_businessman: 'BUSINESSMAN',
  char_fox: 'FOX',
  char_frog: 'FROG',
  char_bear: 'BROWN BEAR',
}

const strings = { zh, en }
export type CopyKey = keyof typeof zh

export function detectLocale(): Locale {
  const override = localStorage.getItem('game_locale')
  if (override === 'zh' || override === 'en') return override
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

export function createTranslator(locale: Locale) {
  return (key: CopyKey, vars?: { n?: string | number }) => {
    let value = strings[locale][key]
    if (vars?.n !== undefined) value = value.replace('{n}', String(vars.n))
    return value
  }
}
