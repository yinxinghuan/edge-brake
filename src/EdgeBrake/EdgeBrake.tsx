import { useMemo, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react'
import aigramSrc from './img/aigram.svg'
import EdgeBrakeScene from './components/EdgeBrakeScene'
import { useEdgeBrake } from './hooks/useEdgeBrake'
import { createTranslator, detectLocale, type CopyKey } from './i18n'
import { FIELD_H, FIELD_W, type Rating } from './types'
import './EdgeBrake.less'

function SoundIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9H4Z" />
      {muted ? <path d="m17 9 4 6m0-6-4 6" /> : <path d="M16.5 8.2c1.8 2 1.8 5.6 0 7.6M19 5.8c3.5 3.4 3.5 9 0 12.4" />}
    </svg>
  )
}

export default function EdgeBrake() {
  const { view, scale, start, setBraking, toggleMuted, goHome } = useEdgeBrake()
  const [locale] = useState(detectLocale)
  const t = useMemo(() => createTranslator(locale), [locale])
  const isInteractive = view.phase === 'ready' || view.phase === 'playing'
  const showHud = view.phase !== 'cover'
  const ratingCopy: Record<Rating, CopyKey> = {
    edge: 'edge', great: 'great', safe: 'safe', early: 'early',
  }

  const handlePointerDown = (event: ReactPointerEvent) => {
    if (!isInteractive) return
    event.currentTarget.setPointerCapture(event.pointerId)
    setBraking(true)
  }

  const handlePointerUp = (event: ReactPointerEvent) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    setBraking(false)
  }

  return (
    <main
      className={`eb eb--${view.phase}${view.isBraking ? ' eb--braking' : ''}`}
      data-phase={view.phase}
      data-x={view.x.toFixed(2)}
      data-velocity={view.velocity.toFixed(2)}
      data-cliff={view.cliffX}
      style={{ width: FIELD_W, height: FIELD_H, transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center' }}
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerCancel={() => setBraking(false)}
      onContextMenu={event => event.preventDefault()}
    >
      <div className="eb__sky" aria-hidden="true">
        <span className="eb__wind eb__wind--one" />
        <span className="eb__wind eb__wind--two" />
        <span className="eb__moon" />
        <span className="eb__mountain eb__mountain--far" />
        <span className="eb__mountain eb__mountain--near" />
      </div>

      <button
        className="eb__sound"
        type="button"
        aria-label={view.muted ? t('soundOn') : t('soundOff')}
        onPointerDown={event => event.stopPropagation()}
        onClick={toggleMuted}
      >
        <SoundIcon muted={view.muted} />
      </button>

      {showHud && (
        <header className="eb-hud">
          <div className="eb-hud__item"><span>{t('level')}</span><strong>{view.level}</strong></div>
          <div className="eb-hud__item eb-hud__item--score"><span>{t('score')}</span><strong>{view.score}</strong></div>
          <div className={`eb-hud__item${view.combo > 0 ? ' eb-hud__item--hot' : ''}`}><span>{t('combo')}</span><strong>×{view.combo}</strong></div>
        </header>
      )}

      <section className="eb-stage" aria-label={t('title')}>
        <EdgeBrakeScene x={view.x} cliffX={view.cliffX} braking={view.isBraking} phase={view.phase} rating={view.result?.rating ?? null} />
      </section>

      {view.phase === 'result' && view.result && (
        <div className={`eb-result-tag eb-result-tag--${view.result.rating}`} key={view.eventKey}>
          <strong>{t(ratingCopy[view.result.rating])}</strong>
          <span>{t('distance', { n: view.result.distance })}</span>
          {view.result.points > 0 && <em>+{view.result.points}</em>}
        </div>
      )}

      {view.phase === 'falling' && <div className="eb-fall-copy">{t('fallen')}</div>}

      {view.phase === 'cover' && (
        <section className="eb-cover">
          <div className="eb-cover__eyebrow">SOUTH POLE BRAKE CLUB</div>
          <h1>{t('title')}</h1>
          <p>{t('subtitle')}</p>
          <div className="eb-cover__scene-space" aria-hidden="true" />
          <button className="eb-button" type="button" onPointerDown={event => { event.stopPropagation(); start() }}>
            {t('start')}
          </button>
          <div className="eb-cover__hint">
            <span className="eb-press-icon"><i /></span>
            <strong>{t('hold')}</strong>
          </div>
        </section>
      )}

      {view.phase === 'ready' && <div className="eb-ready" key={view.eventKey}>{t('ready')}</div>}

      {isInteractive && (
        <div className={`eb-brake-hint${view.isBraking ? ' eb-brake-hint--active' : ''}`}>
          <span className="eb-brake-hint__disc"><i /></span>
          <div>
            <strong>{view.isBraking ? t('release') : t('hold')}</strong>
            <span className="eb-brake-hint__meter"><i style={{ transform: `scaleX(${Math.min(view.velocity / 250, 1)})` } as CSSProperties} /></span>
          </div>
        </div>
      )}

      {view.phase === 'gameover' && (
        <section className="eb-gameover">
          <div className="eb-gameover__sheet">
            <span className="eb-gameover__stamp">SLIP!</span>
            <h2>{t('resultTitle')}</h2>
            <div className="eb-gameover__score"><span>{t('score')}</span><strong>{view.score}</strong></div>
            <dl>
              <div><dt>{t('passed')}</dt><dd>{Math.max(0, view.level - 1)}{locale === 'zh' ? t('unitRounds') : ''}</dd></div>
              <div><dt>{t('bestDistance')}</dt><dd>{view.bestDistance === null ? t('none') : `${view.bestDistance}px`}</dd></div>
              <div><dt>{t('bestCombo')}</dt><dd>×{view.bestCombo}</dd></div>
              <div><dt>{t('bestScore')}</dt><dd>{view.bestScore}</dd></div>
            </dl>
            <button className="eb-button" type="button" onPointerDown={event => { event.stopPropagation(); start() }}>{t('again')}</button>
            <button className="eb-gameover__home" type="button" onPointerDown={event => event.stopPropagation()} onClick={goHome}>{t('home')}</button>
          </div>
        </section>
      )}

      <img className="eb__watermark" src={aigramSrc} alt="" draggable={false} />
    </main>
  )
}
