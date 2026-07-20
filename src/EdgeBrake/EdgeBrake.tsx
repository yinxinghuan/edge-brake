import { useMemo, useState, type CSSProperties } from 'react'
import { CHARACTERS, CHARACTER_BY_ID, characterName, nextRosterCharacter, weatherForLevel } from './characters'
import EdgeBrakeScene from './components/EdgeBrakeScene'
import Watermark from './components/Watermark'
import { useEdgeBrake } from './hooks/useEdgeBrake'
import { createTranslator, detectLocale, type CopyKey } from './i18n'
import { SURFACE_FACTOR } from './physics'
import { FIELD_H, FIELD_W, type CharacterId, type Rating } from './types'
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

function TouchAppIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M9 11.24V7.5C9 6.12 10.12 5 11.5 5S14 6.12 14 7.5v3.74c1.21-.81 2-2.18 2-3.74C16 5.01 13.99 3 11.5 3S7 5.01 7 7.5c0 1.56.79 2.93 2 3.74zm9.84 4.63-4.54-2.26c-.17-.07-.35-.11-.54-.11H13v-6c0-.83-.67-1.5-1.5-1.5S10 6.67 10 7.5v10.74l-3.43-.72c-.08-.01-.15-.03-.24-.03-.31 0-.59.13-.79.33l-.79.8 4.94 4.94c.27.27.65.44 1.06.44h6.79c.75 0 1.33-.55 1.44-1.28l.75-5.27c.01-.07.02-.14.02-.2 0-.62-.38-1.16-.91-1.39z" />
    </svg>
  )
}

export default function EdgeBrake() {
  const { view, scale, beginCharge, releaseCharge, prepareRetry, advanceResult, toggleMuted, goHome, selectCharacter, buyCharacter } = useEdgeBrake()
  const [locale] = useState(detectLocale)
  const [rosterOpen, setRosterOpen] = useState(false)
  const [deniedCharacter, setDeniedCharacter] = useState<CharacterId | null>(null)
  const t = useMemo(() => createTranslator(locale), [locale])
  const currentCharacter = CHARACTER_BY_ID[view.characterId]
  const showChargeUi = (view.phase === 'cover' || view.phase === 'awaiting' || view.phase === 'charging') && !rosterOpen
  const showHud = view.phase !== 'cover'
  const weather = weatherForLevel(view.level)
  const trackProgress = Math.min(1, Math.max(0, (view.x - 40) / Math.max(1, view.cliffX - 40)))
  const ratingCopy: Record<Rating, CopyKey> = {
    edge: 'edge', great: 'great', safe: 'safe', early: 'early',
  }
  const nextResultCharacter = view.result?.passed
    ? CHARACTERS.find(character => !view.unlockedCharacters.includes(character.id)) ?? nextRosterCharacter(view.characterId)
    : CHARACTER_BY_ID[view.characterId]

  return (
    <main
      className={`eb eb--${view.phase}`}
      data-phase={view.phase}
      data-level={view.level}
      data-x={view.x.toFixed(2)}
      data-velocity={view.velocity.toFixed(2)}
      data-cliff={view.cliffX}
      data-character={view.characterId}
      data-weight={currentCharacter.weight}
      data-speed={currentCharacter.speed}
      data-charge={view.chargePower.toFixed(3)}
      data-weather={weather}
      data-track-progress={trackProgress.toFixed(3)}
      data-speed-zone={trackProgress < 0.3 ? 'launch' : trackProgress < 0.68 ? 'boost' : 'cliff'}
      style={{ width: FIELD_W, height: FIELD_H, transform: `translate(-50%, -50%) scale(${scale})`, transformOrigin: 'center' }}
      onPointerDown={event => {
        if (rosterOpen || (event.target as HTMLElement).closest('button')) return
        if (view.phase === 'cover' || view.phase === 'awaiting') {
          event.currentTarget.setPointerCapture(event.pointerId)
          beginCharge()
        }
      }}
      onPointerUp={releaseCharge}
      onPointerCancel={releaseCharge}
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
        <EdgeBrakeScene x={view.x} cliffX={view.cliffX} charging={view.isCharging} chargePower={view.chargePower} phase={view.phase} rating={view.result?.rating ?? null} characterId={view.characterId} preloadCharacterId={nextResultCharacter.id} velocity={view.velocity} weather={weather} />
      </section>

      <Watermark />

      {view.phase === 'playing' && (
        <div className="eb-surface">
          <span>{t(`weather_${weather}` as CopyKey)}</span>
          <strong>{t('surfaceResistance')} ×{SURFACE_FACTOR[weather].toFixed(2)}</strong>
        </div>
      )}

      {showChargeUi && (
        <div className={`eb-character-stats${view.phase === 'charging' ? ' eb-character-stats--charging' : ''}`}>
          <strong>{characterName(view.characterId, locale)}</strong>
          <span><i>{t('weight')}</i><b>{currentCharacter.weight}kg</b></span>
          <span><i>{t('speed')}</i><b>{currentCharacter.speed.toFixed(1)}</b></span>
        </div>
      )}

      {showChargeUi && (
        <div className={`eb-charge${view.phase === 'charging' ? ' eb-charge--active' : ''}${view.chargePower >= 0.82 ? ' eb-charge--strong' : ''}`}>
          <span className="eb-charge__finger"><TouchAppIcon /></span>
          <div>
            <strong>{view.phase === 'charging' ? t('releaseToLaunch') : t('holdToCharge')}</strong>
            <span className="eb-charge__meter"><i style={{ transform: `scaleX(${view.phase === 'charging' ? view.chargePower : 0})` } as CSSProperties} /></span>
          </div>
          <em>{view.phase === 'charging' ? `${Math.round(view.chargePower * 100)}%` : t('hold')}</em>
        </div>
      )}

      {view.phase === 'result' && view.result && (
        <section className={`eb-round-result eb-round-result--${view.result.rating}`} key={view.eventKey} onPointerDown={event => event.stopPropagation()}>
          <div className="eb-round-result__score"><span>{t('roundScore')}</span><strong>{view.result.points}</strong><small>/ 100</small></div>
          <div className="eb-round-result__summary">
            <strong>{t(ratingCopy[view.result.rating])}</strong>
            <span>{t('distance', { n: view.result.distance })}</span>
            <small><CoinIcon />+{view.result.coins}</small>
          </div>
          <div className="eb-round-result__next">
            <img src={nextResultCharacter.spriteUrl} alt="" draggable={false} />
            <span>{view.result.passed ? t('nextCrew') : t('retryCrew')}</span>
            <strong>{characterName(nextResultCharacter.id, locale)}</strong>
          </div>
          <button className="eb-button" type="button" onClick={advanceResult}>
            {view.result.passed ? t('nextCharacter') : t('retryRound')}
          </button>
          <button className="eb-round-result__crew" type="button" onClick={() => setRosterOpen(true)}><CrewIcon />{t('expedition')}</button>
        </section>
      )}

      {view.phase === 'success' && view.result && (
        <div className={`eb-success-callout eb-success-callout--${view.result.rating}`} key={`success-${view.eventKey}`} aria-live="polite">
          <span>{view.result.points}<small>/100</small></span>
          <strong>{t(ratingCopy[view.result.rating])}</strong>
          <em>{t('distance', { n: view.result.distance })}</em>
        </div>
      )}

      {view.phase === 'earlyFail' && view.result && (
        <div className="eb-early-fail-callout" key={`early-fail-${view.eventKey}`} aria-live="polite">
          <span>{t('earlyFailTitle')}</span>
          <strong>{t('earlyFailReason')}</strong>
          <em>{t('earlyFailRule')} · {t('distance', { n: view.result.distance })}</em>
        </div>
      )}

      {view.phase === 'falling' && <div className="eb-fall-copy">{t('fallen')}</div>}

      {view.newUnlock && (
        <div className="eb-unlock-toast" key={`unlock-${view.newUnlock}-${view.eventKey}`}>
          <CrewIcon />
          <span>{t('unlocked')}</span>
          <strong>{characterName(view.newUnlock, locale)}</strong>
        </div>
      )}

      {view.phase === 'cover' && (
        <section className="eb-cover">
          <div className="eb-cover__eyebrow">SOUTH POLE BRAKE CLUB</div>
          <h1>{t('title')}</h1>
          <p>{t('subtitle')}</p>
          <div className="eb-cover__scene-space" aria-hidden="true" />
          <button className="eb-crew-entry" type="button" onPointerDown={event => event.stopPropagation()} onClick={() => setRosterOpen(true)}>
            <span><CrewIcon /></span>
            <strong>{t('expedition')}</strong>
            <em>{t('collection', { n: view.unlockedCharacters.length })}</em>
            <i><CoinIcon />{view.coins}</i>
          </button>
        </section>
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
            <button
              className="eb-button"
              type="button"
              onPointerDown={event => event.stopPropagation()}
              onClick={event => { event.stopPropagation(); setRosterOpen(false); prepareRetry() }}
            >
              {t('again')}
            </button>
            <button className="eb-gameover__crew" type="button" onPointerDown={event => event.stopPropagation()} onClick={() => setRosterOpen(true)}><CrewIcon />{t('expedition')}</button>
            <button className="eb-gameover__home" type="button" onPointerDown={event => event.stopPropagation()} onClick={goHome}>{t('home')}</button>
          </div>
        </section>
      )}

      {rosterOpen && (
        <section className="eb-roster" aria-label={t('expedition')} onPointerDown={event => event.stopPropagation()}>
          <div className="eb-roster__sheet">
            <header>
              <div><span>{t('expedition')}</span><strong>{t('collection', { n: view.unlockedCharacters.length })} · {t('expeditionNote')}</strong></div>
              <div className="eb-roster__balance"><CoinIcon />{view.coins}</div>
              <button type="button" aria-label={t('close')} onClick={() => { setRosterOpen(false); setDeniedCharacter(null) }}><CloseIcon /></button>
            </header>
            <div className="eb-roster__grid">
              {CHARACTERS.map(character => {
                const unlocked = view.unlockedCharacters.includes(character.id)
                const selected = view.characterId === character.id
                const short = Math.max(0, character.cost - view.coins)
                return (
                  <button
                    key={character.id}
                    type="button"
                    className={`eb-roster-card${selected ? ' eb-roster-card--selected' : ''}${!unlocked ? ' eb-roster-card--locked' : ''}${deniedCharacter === character.id ? ' eb-roster-card--denied' : ''}`}
                    onClick={() => {
                      const success = unlocked ? selectCharacter(character.id) : buyCharacter(character.id)
                      setDeniedCharacter(success ? null : character.id)
                    }}
                  >
                    <span className="eb-roster-card__portrait"><img src={character.spriteUrl} alt="" draggable={false} loading="lazy" /></span>
                    <strong>{characterName(character.id, locale)}</strong>
                    <span className="eb-roster-card__category">{t(`category_${character.category}` as CopyKey)}</span>
                    <span className="eb-roster-card__stats">
                      <i>{t('weight')} <b>{character.weight}kg</b></i>
                      <i>{t('speed')} <b>{character.speed.toFixed(1)}</b></i>
                    </span>
                    <span className={`eb-roster-card__tag${selected ? ' is-selected' : unlocked ? ' is-owned' : ''}`}>
                      {selected ? t('inUse') : unlocked ? t('owned') : t('buy', { n: character.cost })}
                    </span>
                    {deniedCharacter === character.id && short > 0 && <span className="eb-roster-card__deny">{t('notEnough', { n: short })}</span>}
                  </button>
                )
              })}
            </div>
          </div>
        </section>
      )}
    </main>
  )
}
