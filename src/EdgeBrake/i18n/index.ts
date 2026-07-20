export type Locale = 'zh' | 'en'

const zh = {
  title: '急刹车',
  subtitle: '停得越险，分得越高',
  start: '开始滑行',
  hold: '按住刹车',
  release: '松开继续滑',
  ready: '准备——',
  level: '关卡',
  score: '分数',
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
}

const en: typeof zh = {
  title: 'EDGE BRAKE',
  subtitle: 'Stop close. Score big.',
  start: 'START SLIDING',
  hold: 'HOLD TO BRAKE',
  release: 'RELEASE TO SLIDE',
  ready: 'READY—',
  level: 'LEVEL',
  score: 'SCORE',
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
