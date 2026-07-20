import { useMemo, useState, type CSSProperties } from 'react'
import aigramSrc from './img/aigram.svg'
import { CHARACTERS, CHARACTER_BY_ID, weatherForLevel } from './characters'
import EdgeBrakeScene from './components/EdgeBrakeScene'
import { useEdgeBrake } from './hooks/useEdgeBrake'
import { createTranslator, detectLocale, type CopyKey } from './i18n'
import { FIELD_H, FIELD_W, PENGUIN_FRONT, type CharacterId, type Rating } from './types'
import './EdgeBrake.less'

function SoundIcon({ muted }: { muted: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M4 9v6h4l5 4V5L8 9H4Z" />
      {muted ? <path d="m17 9 4 6m0-6-4 6" /> : <path d="M16.5 8.2c1.8 2 1.8 5.6 0 7.6M19 5.8c3.5 3.4 3.5 9 0 12.4" />}
    </svg>
  )
}

function CoinIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" fill="none"><circle cx="12" cy="12" r="8" fill="#ffd166" /><path d="M9 9.4c.7-1.2 4.7-1.1 4.9.6.2 1.9-5.5 1.3-4.8 3.5.5 1.5 4.4 1.6 5 .2M12 6.5v11" stroke="currentColor" strokeLinecap="round" /></svg>
}

function CrewIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3" /><circle cx="17" cy="9" r="2.4" /><path d="M3.5 19c.4-4 2.2-6 5.5-6s5.1 2 5.5 6M14 14c3.8-.6 5.8 1.1 6.4 4.2" /></svg>
}

function CloseIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
}

function PenguinPortrait() {
  return (
    <svg className="eb-character-portrait" viewBox="0 0 96 96" aria-hidden="true">
      <ellipse cx="48" cy="82" rx="30" ry="7" fill="#16303a" opacity=".22" />
      <path d="M28 69c-5-17-2-43 17-53 21 7 29 34 20 55-10 9-28 8-37-2Z" fill="#17272d" />
      <path d="M42 67c-5-12-3-29 6-38 13 8 17 25 11 39-5 5-12 5-17-1Z" fill="#f5f0dd" />
      <path d="m62 37 20 8-18 8Z" fill="#f3a83b" />
      <circle cx="59" cy="31" r="3.5" fill="#f7fbf6" /><circle cx="60" cy="32" r="1.7" fill="#102129" />
      <path d="M32 71 15 80l22 2ZM59 72l20 8-23 3Z" fill="#f3a83b" />
      <path d="m30 43-13 20 18-7ZM65 47l14 18-18-8Z" fill="#17272d" />
    </svg>
  )
}

export default function EdgeBrake() {
  const { view, scale, start, triggerBrake, toggleMuted, goHome, selectCharacter, buyCharacter } = useEdgeBrake()
  const [locale] = useState(detectLocale)
  const [rosterOpen, setRosterOpen] = useState(false)
  const [deniedCharacter, setDeniedCharacter] = useState<CharacterId | null>(null)
  const t = useMemo(() => createTranslator(locale), [locale])
  const isInteractive = (view.phase === 'ready' || view.phase === 'playing') && !rosterOpen
  const showHud = view.phase !== 'cover'
  const weather = weatherForLevel(view.level)
  const remaining = Math.max(0, Math.round(view.cliffX - (view.x + PENGUIN_FRONT)))
  const danger = Math.min(1, Math.max(0, 1 - remaining / Math.max(1, view.cliffX - 64 - PENGUIN_FRONT)))
  const ratingCopy: Record<Rating, CopyKey> = {
    edge: 'edge', great: 'great', safe: 'safe', early: 'early',
  }

  return (
    <main
      className={`eb eb--${view.phase}${view.isBraking ? ' eb--braking' : ''}`}
      data-phase={view.phase}
      data-level={view.level}
      data-x={view.x.toFixed(2)}
      data-velocity={view.velocity.toFixed(2)}
      data-cliff={view.cliffX}
      data-character={view.characterId}
      data-friction={CHARACTER_BY_ID[view.characterId].friction}
      data-weather={weather}
      style={{ width: FIELD_W, height: FIELD_H, transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center' }}
      onPointerDown={() => { if (isInteractive) triggerBrake() }}
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
          <div className="eb-hud__item eb-hud__item--coins"><span>{t('coins')}</span><strong><CoinIcon />{view.coins}</strong></div>
        </header>
      )}

      <section className="eb-stage" aria-label={t('title')}>
        <EdgeBrakeScene x={view.x} cliffX={view.cliffX} braking={view.isBraking} phase={view.phase} rating={view.result?.rating ?? null} characterId={view.characterId} velocity={view.velocity} weather={weather} />
      </section>

      {isInteractive && (
        <div className={`eb-danger${danger > 0.72 ? ' eb-danger--hot' : ''}`}>
          <span>{t('cliffDistance')}</span>
          <strong>{remaining}<small>px</small></strong>
          <i><b style={{ transform: `scaleX(${danger})` }} /></i>
          <em>{t(`weather_${weather}` as CopyKey)}</em>
        </div>
      )}

      {view.phase === 'result' && view.result && (
        <div className={`eb-result-tag eb-result-tag--${view.result.rating}`} key={view.eventKey}>
          <strong>{t(ratingCopy[view.result.rating])}</strong>
          <span>{t('distance', { n: view.result.distance })}</span>
          <small><CoinIcon />+{view.result.coins}</small>
          {view.result.points > 0 && <em>+{view.result.points}</em>}
        </div>
      )}

      {view.phase === 'falling' && <div className="eb-fall-copy">{t('fallen')}</div>}

      {view.newUnlock && (
        <div className="eb-unlock-toast" key={`unlock-${view.newUnlock}-${view.eventKey}`}>
          <CrewIcon />
          <span>{t('unlocked')}</span>
          <strong>{t(`char_${view.newUnlock}` as CopyKey)}</strong>
        </div>
      )}

      {view.phase === 'cover' && (
        <section className="eb-cover">
          <div className="eb-cover__eyebrow">SOUTH POLE BRAKE CLUB</div>
          <h1>{t('title')}</h1>
          <p>{t('subtitle')}</p>
          <div className="eb-cover__scene-space" aria-hidden="true" />
          <button className="eb-button" type="button" onPointerDown={event => { event.stopPropagation(); setRosterOpen(false); start() }}>
            {t('start')}
          </button>
          <button className="eb-crew-entry" type="button" onPointerDown={event => event.stopPropagation()} onClick={() => setRosterOpen(true)}>
            <span><CrewIcon /></span>
            <strong>{t('expedition')}</strong>
            <em>{t(`char_${view.characterId}` as CopyKey)} · ×{CHARACTER_BY_ID[view.characterId].friction.toFixed(2)}</em>
            <i><CoinIcon />{view.coins}</i>
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
              <div><dt>{t('runCoins')}</dt><dd className="eb-gameover__coin"><CoinIcon />{view.runCoins}</dd></div>
              <div><dt>{t('bestDistance')}</dt><dd>{view.bestDistance === null ? t('none') : `${view.bestDistance}px`}</dd></div>
              <div><dt>{t('coins')}</dt><dd className="eb-gameover__coin"><CoinIcon />{view.coins}</dd></div>
              <div><dt>{t('bestScore')}</dt><dd>{view.bestScore}</dd></div>
            </dl>
            <button className="eb-button" type="button" onPointerDown={event => { event.stopPropagation(); setRosterOpen(false); start() }}>{t('again')}</button>
            <button className="eb-gameover__crew" type="button" onPointerDown={event => event.stopPropagation()} onClick={() => setRosterOpen(true)}><CrewIcon />{t('expedition')}</button>
            <button className="eb-gameover__home" type="button" onPointerDown={event => event.stopPropagation()} onClick={goHome}>{t('home')}</button>
          </div>
        </section>
      )}

      {rosterOpen && (
        <section className="eb-roster" aria-label={t('expedition')} onPointerDown={event => event.stopPropagation()}>
          <div className="eb-roster__sheet">
            <header>
              <div><span>{t('expedition')}</span><strong>{t('expeditionNote')}</strong></div>
              <div className="eb-roster__balance"><CoinIcon />{view.coins}</div>
              <button type="button" aria-label={t('close')} onClick={() => { setRosterOpen(false); setDeniedCharacter(null) }}><CloseIcon /></button>
            </header>
            <div className="eb-roster__grid">
              {CHARACTERS.map(character => {
                const unlocked = view.unlockedCharacters.includes(character.id)
                const selected = view.characterId === character.id
                const milestoneLocked = Boolean(character.unlockLevel && view.maxLevel < character.unlockLevel)
                const short = Math.max(0, character.cost - view.coins)
                return (
                  <button
                    key={character.id}
                    type="button"
                    className={`eb-roster-card${selected ? ' eb-roster-card--selected' : ''}${!unlocked ? ' eb-roster-card--locked' : ''}${deniedCharacter === character.id ? ' eb-roster-card--denied' : ''}`}
                    onClick={() => {
                      const success = unlocked ? selectCharacter(character.id) : !milestoneLocked && buyCharacter(character.id)
                      setDeniedCharacter(success ? null : character.id)
                    }}
                  >
                    <span className="eb-roster-card__portrait">{character.spriteUrl ? <img src={character.spriteUrl} alt="" draggable={false} /> : <PenguinPortrait />}</span>
                    <strong>{t(`char_${character.id}` as CopyKey)}</strong>
                    <span className="eb-roster-card__grip"><i>{t('friction')}</i><b><em style={{ width: `${character.friction / 1.22 * 100}%` }} /></b><small>×{character.friction.toFixed(2)}</small></span>
                    <span className={`eb-roster-card__tag${selected ? ' is-selected' : unlocked ? ' is-owned' : ''}`}>
                      {selected ? t('inUse') : unlocked ? t('owned') : milestoneLocked ? t('levelUnlock', { n: character.unlockLevel }) : t('buy', { n: character.cost })}
                    </span>
                    {deniedCharacter === character.id && !milestoneLocked && short > 0 && <span className="eb-roster-card__deny">{t('notEnough', { n: short })}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        </section>
      )}

      <img className="eb__watermark" src={aigramSrc} alt="" draggable={false} />
    </main>
  )
}
