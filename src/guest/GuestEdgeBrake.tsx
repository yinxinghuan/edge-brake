import { useEffect, useState, type CSSProperties } from 'react'
import { CHARACTERS, CHARACTER_BY_ID, characterName, nextRosterCharacter, weatherForLevel } from '../EdgeBrake/characters'
import EdgeBrakeScene from '../EdgeBrake/components/EdgeBrakeScene'
import { FIELD_H, FIELD_W, type CharacterId, type WeatherKind } from '../EdgeBrake/types'
import '../EdgeBrake/EdgeBrake.less'
import { desk, game, ratingCopy } from './copy'
import {
  CAMP_XP_PER_LEVEL,
  UPGRADES,
  campXpIntoLevel,
  contractById,
  gearSummary,
  quoteUpgrade,
  type UpgradeId,
} from './meta'
import { suggestHold } from './recommend'
import { useBgm } from './useBgm'
import { canShop, useGuestBrake } from './useGuestBrake'
import './GuestEdgeBrake.less'

const FRAME_W = 1280
const FRAME_H = 720

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

function WeatherIcon({ weather }: { weather: WeatherKind }) {
  if (weather === 'clear') return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="3.4" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.3 5.3l2.1 2.1m9.2 9.2 2.1 2.1m0-13.4-2.1 2.1m-9.2 9.2-2.1 2.1" /></svg>
  if (weather === 'fog') return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8.5h16M2.5 12h14M5.5 15.5h15M3.5 19h11" /></svg>
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6.8 10.2a4.1 4.1 0 0 1 7.9-1.1A3.4 3.4 0 1 1 17.2 15H7.3a3.1 3.1 0 0 1-.5-4.8Z" /><path d={weather === 'blizzard' ? 'm5 18 3-2m2 5 3-2m2 3 3-2' : 'm8 18 .01 0M12 20 .01 0M16 18 .01 0'} /></svg>
}

export default function GuestEdgeBrake() {
  const {
    view, meta, banner, locksRef, camp,
    beginCharge, releaseCharge, prepareRetry, advanceResult,
    toggleMuted, goHome, selectCharacter, buyCharacter, buyUpgrade, markTutorialDone,
  } = useGuestBrake()
  const [scale, setScale] = useState(1)
  const [rosterOpen, setRosterOpen] = useState(false)
  const [deniedCharacter, setDeniedCharacter] = useState<CharacterId | null>(null)
  const [tutorialStep, setTutorialStep] = useState<number | null>(meta.tutorialDone ? null : 0)
  useBgm(view.muted)

  locksRef.current.tutorial = tutorialStep !== null
  locksRef.current.roster = rosterOpen

  const currentCharacter = CHARACTER_BY_ID[view.characterId]
  const weather = weatherForLevel(view.level)
  const shopping = canShop(view.phase)
  const showChargeUi = (view.phase === 'cover' || view.phase === 'awaiting' || view.phase === 'charging') && !rosterOpen
  const showHud = view.phase !== 'cover'
  const trackProgress = Math.min(1, Math.max(0, (view.x - 40) / Math.max(1, view.cliffX - 40)))
  const remaining = Math.max(0, Math.round(view.cliffX - (view.x + 49)))
  const nextResultCharacter = view.result?.passed
    ? CHARACTERS.find(character => !view.unlockedCharacters.includes(character.id)) ?? nextRosterCharacter(view.characterId)
    : CHARACTER_BY_ID[view.characterId]
  const hint = (view.phase === 'awaiting' || view.phase === 'charging') && !rosterOpen
    ? suggestHold(currentCharacter, weather, view.cliffX, meta.springs, meta.studs, meta.sense)
    : null
  const gear = gearSummary(meta)
  const tutorial = tutorialStep === null ? null : desk.steps[tutorialStep]
  const xpInto = campXpIntoLevel(meta.xp)

  useEffect(() => {
    const compute = () => setScale(Math.min(window.innerWidth / FRAME_W, window.innerHeight / FRAME_H))
    compute()
    window.addEventListener('resize', compute)
    return () => window.removeEventListener('resize', compute)
  }, [])

  useEffect(() => {
    if (!canShop(view.phase)) setRosterOpen(false)
  }, [view.phase])

  const closeTutorial = () => {
    markTutorialDone()
    setTutorialStep(null)
  }

  const nextTutorial = () => {
    setTutorialStep(step => {
      if (step === null) return null
      if (step >= desk.steps.length - 1) {
        markTutorialDone()
        return null
      }
      return step + 1
    })
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat) return
      if (tutorialStep !== null) {
        if (event.code === 'Escape') {
          event.preventDefault()
          closeTutorial()
        } else if (event.code === 'Space' || event.code === 'Enter') {
          event.preventDefault()
          nextTutorial()
        }
        return
      }
      if (event.code === 'Escape' && rosterOpen) {
        event.preventDefault()
        setRosterOpen(false)
        setDeniedCharacter(null)
        return
      }
      if (event.code === 'KeyC') {
        if (!rosterOpen && !canShop(view.phase)) return
        event.preventDefault()
        setRosterOpen(open => !open)
        setDeniedCharacter(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  })

  return (
    <div className="cg-screen" data-guest="crazygames" data-tutorial={tutorialStep ?? 'off'} data-phase={view.phase} data-camp={camp}>
      <div className="cg-frame" style={{ transform: `scale(${scale})` }}>
        <header className="cg-top">
          <div className="cg-brand">
            <strong>{game.title}</strong>
            <span>{game.eyebrow}</span>
          </div>
          <div className="cg-camp" aria-label={`Camp ${camp}`}>
            <span>{desk.camp} {camp}</span>
            <i><b style={{ width: `${(xpInto / CAMP_XP_PER_LEVEL) * 100}%` }} /></i>
            <em>{xpInto}/{CAMP_XP_PER_LEVEL}</em>
          </div>
          <div className="cg-top-actions">
            <span className="cg-best">{desk.best} {view.bestScore}</span>
            <button className="cg-icon-button" type="button" aria-label={view.muted ? game.soundOn : game.soundOff} onClick={toggleMuted}>
              <SoundIcon muted={view.muted} />
            </button>
          </div>
        </header>

        {banner && <p className="cg-banner" role="status">{banner}</p>}

        <div className="cg-body">
          <aside className="cg-panel" aria-label={desk.contracts}>
            <div className="cg-panel__head">
              <h2>{desk.contracts}</h2>
              <button type="button" onClick={() => setTutorialStep(0)}>{desk.howTo}</button>
            </div>
            <section className="cg-ice">
              <span>{desk.thisIce}</span>
              <strong><WeatherIcon weather={weather} />{game.weather[weather]}</strong>
              <p>{game.weatherEffect[weather]} {game.weatherChange[weather]}</p>
              <p>{desk.passRule}</p>
              <p>{desk.clears}: {meta.runClears}</p>
            </section>
            <ul className="cg-contracts">
              {meta.contracts.map(slot => {
                const def = contractById(slot.id)
                if (!def) return null
                return (
                  <li key={slot.id}>
                    <div>
                      <strong>{def.title}</strong>
                      <em>{slot.progress}/{def.target}</em>
                    </div>
                    <p>{def.detail}</p>
                    <i className="cg-bar"><b style={{ width: `${Math.min(100, (slot.progress / def.target) * 100)}%` }} /></i>
                    <small>+{def.rewardCoins} coins · +{def.rewardXp} XP</small>
                  </li>
                )
              })}
            </ul>
          </aside>

          <div className="cg-play-slot">
            <div className="cg-play-scale">
              <main
                className={`eb eb--${view.phase}`}
                data-phase={view.phase}
                data-level={view.level}
                data-character={view.characterId}
                data-weather={weather}
                style={{ width: FIELD_W, height: FIELD_H, left: 0, top: 0, transform: 'none' }}
                onPointerDown={event => {
                  if (rosterOpen || tutorialStep !== null || (event.target as HTMLElement).closest('button')) return
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

                {showHud && (
                  <header className="eb-hud">
                    <div className="eb-hud__item"><span>{game.level}</span><strong>{view.level}</strong></div>
                    <div className="eb-hud__item eb-hud__item--score"><span>{game.score}</span><strong>{view.score}</strong></div>
                    <div className="eb-hud__item eb-hud__item--coins"><span>{game.coins}</span><strong><CoinIcon />{view.coins}</strong></div>
                  </header>
                )}

                <section className="eb-stage" aria-label={game.title}>
                  <EdgeBrakeScene
                    x={view.x}
                    cliffX={view.cliffX}
                    charging={view.isCharging}
                    autoBraking={view.isAutoBraking}
                    chargePower={view.chargePower}
                    phase={view.phase}
                    rating={view.result?.rating ?? null}
                    characterId={view.characterId}
                    preloadCharacterId={nextResultCharacter.id}
                    velocity={view.velocity}
                    weather={weather}
                  />
                </section>

                {view.phase === 'playing' && weather !== 'clear' && <div className={`eb-weather-screen eb-weather-screen--${weather}`} aria-hidden="true"><i /><i /><i /></div>}

                {view.phase === 'playing' && (
                  <div className={`eb-danger${view.isAutoBraking || trackProgress > 0.72 ? ' eb-danger--hot' : ''}`}>
                    <span>{game.cliffDistance}</span>
                    <strong>{remaining}<small>px</small></strong>
                    <i><b style={{ transform: `scaleX(${trackProgress})` }} /></i>
                    <span className="eb-danger__weather"><WeatherIcon weather={weather} />{game.weather[weather]}</span>
                    <em>{game.weatherEffect[weather]} · {game.weatherChange[weather]}</em>
                  </div>
                )}

                {showChargeUi && view.phase !== 'cover' && !view.newUnlock && (
                  <div className={`eb-weather-brief eb-weather-brief--${weather}`} aria-live="polite">
                    <span className="eb-weather-brief__icon"><WeatherIcon weather={weather} /></span>
                    <span className="eb-weather-brief__copy"><small>{game.weatherForecast}</small><strong>{game.weather[weather]}</strong><em>{game.weatherEffect[weather]}</em></span>
                    <b>{game.weatherChange[weather]}</b>
                  </div>
                )}

                {showChargeUi && view.phase !== 'cover' && !view.newUnlock && (
                  <div className={`eb-character-stats${view.phase === 'charging' ? ' eb-character-stats--charging' : ''}`}>
                    <span><i>{game.weight}</i><b>{currentCharacter.weight}<small>kg</small></b></span>
                    <span><i>{game.speed}</i><b>{currentCharacter.speed.toFixed(1)}</b></span>
                  </div>
                )}

                {showChargeUi && (
                  <div className={`eb-charge${view.phase === 'charging' ? ' eb-charge--active' : ''}${view.chargePower >= 0.82 ? ' eb-charge--strong' : ''}`}>
                    <span className="eb-charge__finger"><TouchAppIcon /></span>
                    <div>
                      <strong>{view.phase === 'charging' ? game.releaseToLaunch : game.holdToCharge}</strong>
                      <span className="eb-charge__meter">
                        <i style={{ transform: `scaleX(${view.phase === 'charging' ? view.chargePower : 0})` } as CSSProperties} />
                        {hint && <b className="cg-hold-mark" style={{ left: `${hint.power * 100}%` }} />}
                      </span>
                      {hint && <small className="cg-hold-label">{hint.text}</small>}
                    </div>
                    <em>{view.phase === 'charging' ? `${Math.round(view.chargePower * 100)}%` : game.hold}</em>
                  </div>
                )}

                {view.phase === 'result' && view.result && (
                  <section className={`eb-round-result eb-round-result--${view.result.rating}`} onPointerDown={event => event.stopPropagation()}>
                    <div className="eb-round-result__score"><span>{game.roundScore}</span><strong>{view.result.points}</strong><small>/ 100</small></div>
                    <div className="eb-round-result__summary">
                      <strong>{ratingCopy[view.result.rating]}</strong>
                      <span>{game.distance(view.result.distance)}</span>
                      <small><CoinIcon />+{view.result.coins}</small>
                    </div>
                    <p className="cg-result-note">{desk.camp} {camp} · {xpInto}/{CAMP_XP_PER_LEVEL} XP · {desk.clears} {meta.runClears}</p>
                    <div className="eb-round-result__next">
                      <img src={nextResultCharacter.spriteUrl} alt="" draggable={false} />
                      <span>{view.result.passed ? game.nextCrew : game.retryCrew}</span>
                      <strong>{characterName(nextResultCharacter.id, 'en')}</strong>
                    </div>
                    <button className="eb-button" type="button" onClick={advanceResult}>
                      {view.result.passed ? game.nextCharacter : game.retryRound}
                    </button>
                    <button className="eb-round-result__crew" type="button" onClick={() => setRosterOpen(true)}><CrewIcon />{game.expedition}</button>
                  </section>
                )}

                {view.phase === 'success' && view.result && (
                  <div className={`eb-success-callout eb-success-callout--${view.result.rating}`} aria-live="polite">
                    <span>{view.result.points}<small>/100</small></span>
                    <strong>{ratingCopy[view.result.rating]}</strong>
                    <em>{game.distance(view.result.distance)}</em>
                  </div>
                )}

                {view.phase === 'earlyFail' && view.result && (
                  <div className="eb-early-fail-callout" aria-live="polite">
                    <span>{game.earlyFailTitle}</span>
                    <strong>{game.earlyFailReason}</strong>
                    <em>{game.earlyFailRule} · {game.distance(view.result.distance)}</em>
                  </div>
                )}

                {view.phase === 'falling' && <div className="eb-fall-copy">{game.fallen}</div>}

                {view.newUnlock && (
                  <div className="eb-unlock-toast">
                    <CrewIcon />
                    <span>{game.unlocked}</span>
                    <strong>{characterName(view.newUnlock, 'en')}</strong>
                  </div>
                )}

                {view.phase === 'cover' && (
                  <section className="eb-cover">
                    <div className="eb-cover__eyebrow">{game.eyebrow}</div>
                    <h1>{game.title}</h1>
                    <p>{game.subtitle}</p>
                    <div className={`eb-weather-brief eb-weather-brief--${weather} eb-weather-brief--compact`}>
                      <span className="eb-weather-brief__icon"><WeatherIcon weather={weather} /></span>
                      <span className="eb-weather-brief__copy"><small>{game.weatherForecast}</small><strong>{game.weather[weather]}</strong><em>{game.weatherEffect[weather]}</em></span>
                    </div>
                    <div className="eb-cover__scene-space" aria-hidden="true" />
                    <div className="eb-cover__entries eb-cover__entries--single">
                      <button className="eb-crew-entry" type="button" aria-label={game.expedition} onPointerDown={event => event.stopPropagation()} onClick={() => setRosterOpen(true)}>
                        <span><CrewIcon /></span>
                        <strong>{game.expedition}</strong>
                        <em>{game.collection(view.unlockedCharacters.length)}</em>
                        <i><CoinIcon />{view.coins}</i>
                      </button>
                    </div>
                  </section>
                )}

                {view.phase === 'gameover' && (
                  <section className="eb-gameover">
                    <div className="eb-gameover__sheet">
                      <span className="eb-gameover__stamp">SLIP!</span>
                      <h2>{game.resultTitle}</h2>
                      <div className="eb-gameover__score"><span>{game.score}</span><strong>{view.score}</strong></div>
                      <dl>
                        <div><dt>{game.passed}</dt><dd>{Math.max(0, view.level - 1)}</dd></div>
                        <div><dt>{game.runCoins}</dt><dd className="eb-gameover__coin"><CoinIcon />{view.runCoins}</dd></div>
                        <div><dt>{game.bestDistance}</dt><dd>{view.bestDistance === null ? '—' : `${view.bestDistance}px`}</dd></div>
                        <div><dt>{game.coins}</dt><dd className="eb-gameover__coin"><CoinIcon />{view.coins}</dd></div>
                        <div><dt>{game.bestScore}</dt><dd>{view.bestScore}</dd></div>
                        <div><dt>{game.bestCombo}</dt><dd>{view.bestCombo}</dd></div>
                      </dl>
                      <p className="cg-result-note cg-result-note--ink">{desk.camp} {camp}. Buy gear, then launch again.</p>
                      <button className="eb-button" type="button" onPointerDown={event => event.stopPropagation()} onClick={event => { event.stopPropagation(); setRosterOpen(false); prepareRetry() }}>
                        {game.again}
                      </button>
                      <button className="eb-gameover__crew" type="button" onPointerDown={event => event.stopPropagation()} onClick={() => setRosterOpen(true)}><CrewIcon />{game.expedition}</button>
                      <button className="eb-gameover__home" type="button" onPointerDown={event => event.stopPropagation()} onClick={goHome}>{game.home}</button>
                    </div>
                  </section>
                )}

                {rosterOpen && (
                  <section className="eb-roster" aria-label={game.expedition} onPointerDown={event => event.stopPropagation()}>
                    <div className="eb-roster__sheet">
                      <header>
                        <div><span>{game.expedition}</span><strong>{game.collection(view.unlockedCharacters.length)} · {game.expeditionNote}</strong></div>
                        <div className="eb-roster__balance"><CoinIcon />{view.coins}</div>
                        <button type="button" aria-label={game.close} onClick={() => { setRosterOpen(false); setDeniedCharacter(null) }}><CloseIcon /></button>
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
                              <strong>{characterName(character.id, 'en')}</strong>
                              <span className="eb-roster-card__category">{game.category[character.category]}</span>
                              <span className="eb-roster-card__stats">
                                <i>{game.weight} <b>{character.weight}kg</b></i>
                                <i>{game.speed} <b>{character.speed.toFixed(1)}</b></i>
                              </span>
                              <span className={`eb-roster-card__tag${selected ? ' is-selected' : unlocked ? ' is-owned' : ''}`}>
                                {selected ? game.inUse : unlocked ? game.owned : game.buy(character.cost)}
                              </span>
                              {deniedCharacter === character.id && short > 0 && <span className="eb-roster-card__deny">{game.notEnough(short)}</span>}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </section>
                )}
              </main>
            </div>
          </div>

          <aside className="cg-panel" aria-label={desk.workshop}>
            <div className="cg-panel__head">
              <h2>{desk.workshop}</h2>
              <strong><CoinIcon />{view.coins}</strong>
            </div>
            <p className="cg-gear">{gear.length ? gear.join(' · ') : desk.stock}</p>
            <p className="cg-rule">{desk.campRule}</p>
            {!shopping && <p className="cg-rule">{desk.shopLocked}</p>}
            <ul className="cg-upgrades">
              {UPGRADES.map(upgrade => {
                const rank = meta[upgrade.id]
                const quote = quoteUpgrade(meta, upgrade.id, view.coins)
                const phaseLocked = !canShop(view.phase)
                const disabled = phaseLocked || !quote.ok
                let label = `${desk.buy} ${quote.cost}`
                if (quote.reason === 'max') label = desk.maxed
                else if (phaseLocked) label = 'BETWEEN ROUNDS'
                else if (quote.reason === 'camp') label = desk.needCamp(quote.nextRank)
                else if (quote.reason === 'coins') label = desk.needCoins(quote.cost - view.coins)
                return (
                  <li key={upgrade.id}>
                    <div>
                      <strong>{upgrade.name}</strong>
                      <em>{rank}/{upgrade.max}</em>
                    </div>
                    <p>{upgrade.detail}</p>
                    <span className="cg-pips" aria-hidden="true">
                      {Array.from({ length: upgrade.max }, (_, index) => <i key={index} className={index < rank ? 'is-on' : ''} />)}
                    </span>
                    <button type="button" disabled={disabled} onClick={() => buyUpgrade(upgrade.id as UpgradeId)}>
                      {label}
                    </button>
                  </li>
                )
              })}
            </ul>
          </aside>
        </div>

        <footer className="cg-keys">
          <p>
            <kbd>Space</kbd> hold to charge, release to launch
            <kbd>Enter</kbd> same
            <kbd>C</kbd> crew
            <kbd>R</kbd> continue
            <kbd>M</kbd> mute
            <kbd>Esc</kbd> close or skip
          </p>
          <span>{desk.music}</span>
        </footer>

        {tutorial && (
          <div className="cg-tutorial" role="dialog" aria-modal="true" aria-labelledby="cg-tutorial-title">
            <div className="cg-tutorial__card">
              <div className="cg-tutorial__top">
                <span>{desk.tutorialKicker} {tutorialStep! + 1}/{desk.steps.length}</span>
                <button type="button" onClick={closeTutorial}>{desk.tutorialSkip}</button>
              </div>
              <h2 id="cg-tutorial-title">{tutorial.title}</h2>
              <p>{tutorial.body}</p>
              <button className="cg-tutorial__go" type="button" onClick={nextTutorial}>
                {tutorialStep === desk.steps.length - 1 ? desk.tutorialStart : desk.tutorialNext}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
