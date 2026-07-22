import { type CSSProperties, useEffect, useState } from 'react'
import { openAigramProfile } from '../runtime/bridge'
import type { LeaderboardEntry } from './useGameScore'
import './Leaderboard.less'

const STRINGS = {
  zh: {
    title: '排行榜', me: '我', empty: '暂无记录，成为第一位冠军吧！',
    openInAlterU: '在 AlterU 中打开即可查看排行榜', downloadAlterU: '下载 AlterU',
    retry: '重新加载', error: '冰面信号中断，请稍后重试', close: '关闭排行榜',
  },
  en: {
    title: 'LEADERBOARD', me: 'ME', empty: 'No records yet. Be the first champion!',
    openInAlterU: 'Open in AlterU to view the leaderboard.', downloadAlterU: 'Get AlterU',
    retry: 'TRY AGAIN', error: 'The ice signal dropped. Try again.', close: 'Close leaderboard',
  },
} as const

function detectLang(): 'zh' | 'en' {
  try {
    const override = localStorage.getItem('game_locale')
    if (override === 'zh' || override === 'en') return override
  } catch { /* ignore */ }
  return navigator.language.toLowerCase().startsWith('zh') ? 'zh' : 'en'
}

function CrownIcon({ compact = false }: { compact?: boolean }) {
  return (
    <svg className={compact ? 'lb-crown lb-crown--compact' : 'lb-crown'} viewBox="0 0 24 24" aria-hidden="true">
      <path d="m4 8 4 4 4-7 4 7 4-4-2 10H6L4 8Z" />
      <path d="M7 21h10" />
    </svg>
  )
}

function CloseIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
}

function Avatar({ url, name, size = 40 }: { url: string; name: string; size?: number }) {
  return (
    <span className="lb-avatar" style={{ width: size, height: size, fontSize: size * 0.38 }} aria-hidden="true">
      {url ? <img src={url} alt="" draggable={false} /> : <span>{(name || '?').charAt(0).toUpperCase()}</span>}
    </span>
  )
}

function RankMark({ rank }: { rank: number }) {
  return <span className={`lb-rank-mark${rank <= 3 ? ` lb-rank-mark--${rank}` : ''}`}>{rank}</span>
}

interface Props {
  gameName: string
  isInAigram: boolean
  onClose: () => void
  fetch: () => Promise<LeaderboardEntry[]>
}

const ALTERU_APP_URL = 'https://alteru.app'

export default function Leaderboard({ gameName, isInAigram, onClose, fetch }: Props) {
  const s = STRINGS[detectLang()]
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    if (!isInAigram) {
      setEntries([])
      setLoading(false)
      setFailed(false)
      return
    }
    let alive = true
    setLoading(true)
    setFailed(false)
    fetch()
      .then(data => { if (alive) setEntries(data) })
      .catch(() => { if (alive) setFailed(true) })
      .finally(() => { if (alive) setLoading(false) })
    return () => { alive = false }
  }, [fetch, isInAigram, reloadKey])

  return (
    <section
      className="lb-backdrop"
      aria-label={s.title}
      onPointerDown={event => {
        event.stopPropagation()
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="lb-panel">
        <header className="lb-header">
          <div className="lb-header__left">
            <span className="lb-header__icon"><CrownIcon /></span>
            <div><div className="lb-header__title">{s.title}</div><div className="lb-header__game">{gameName}</div></div>
          </div>
          <button className="lb-close" type="button" aria-label={s.close} onClick={onClose}><CloseIcon /></button>
        </header>

        <div className="lb-body">
          {loading && <div className="lb-state"><span className="lb-spinner" /><span className="lb-state__text">{s.title}</span></div>}

          {!loading && !isInAigram && (
            <div className="lb-state lb-state--download">
              <CrownIcon />
              <span className="lb-state__text">{s.openInAlterU}</span>
              <a className="lb-state__download" href={ALTERU_APP_URL} target="_blank" rel="noopener noreferrer">{s.downloadAlterU}</a>
            </div>
          )}

          {!loading && isInAigram && failed && (
            <div className="lb-state">
              <CrownIcon compact />
              <span className="lb-state__text">{s.error}</span>
              <button className="lb-state__retry" type="button" onClick={() => setReloadKey(key => key + 1)}>{s.retry}</button>
            </div>
          )}

          {!loading && isInAigram && !failed && entries.length === 0 && (
            <div className="lb-state"><CrownIcon /><span className="lb-state__text">{s.empty}</span></div>
          )}

          {!loading && isInAigram && !failed && entries.map((entry, index) => {
            const rank = Number(entry.rank) || index + 1
            const profileEnabled = !entry.isMe
            return (
              <button
                key={entry.user_id}
                type="button"
                className={`lb-row ${entry.isMe ? 'lb-row--me' : ''} ${rank <= 3 ? 'lb-row--top' : ''}`}
                style={{ '--rank-index': rank } as CSSProperties}
                onClick={profileEnabled ? () => openAigramProfile(entry.user_id) : undefined}
                disabled={!profileEnabled}
              >
                <span className="lb-row__rank"><RankMark rank={rank} /></span>
                <Avatar url={entry.avatar_url} name={entry.name} size={rank <= 3 ? 38 : 34} />
                <span className="lb-row__info">
                  <span className="lb-row__name">{entry.name || '·'}</span>
                  {entry.isMe && <span className="lb-row__me">{s.me}</span>}
                </span>
                <span className="lb-row__score">{entry.score.toLocaleString()}</span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}
