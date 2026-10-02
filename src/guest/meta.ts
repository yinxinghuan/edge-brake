export const SPRING_STEP = 0.035
export const STUD_STEP = 0.03
export const CAMP_XP_PER_LEVEL = 50

export type UpgradeId = 'springs' | 'studs' | 'sense' | 'fund'

export interface UpgradeDef {
  id: UpgradeId
  name: string
  detail: string
  max: number
  costs: number[]
}

export const UPGRADES: UpgradeDef[] = [
  {
    id: 'springs',
    name: 'Launch Springs',
    detail: 'Each rank adds 3.5% launch speed.',
    max: 5,
    costs: [20, 45, 80, 130, 200],
  },
  {
    id: 'studs',
    name: 'Ice Studs',
    detail: 'Each rank adds 3% grip, so you stop sooner.',
    max: 5,
    costs: [20, 45, 80, 130, 200],
  },
  {
    id: 'sense',
    name: 'Cliff Sense',
    detail: 'Rank 1 is a coarse hold. Rank 3 marks the exact target.',
    max: 3,
    costs: [25, 60, 110],
  },
  {
    id: 'fund',
    name: 'Expedition Fund',
    detail: 'Each rank adds 1 bonus coin every time you stop.',
    max: 3,
    costs: [30, 70, 140],
  },
]

export interface ContractDef {
  id: string
  title: string
  detail: string
  target: number
  rewardCoins: number
  rewardXp: number
}

export const CONTRACTS: ContractDef[] = [
  { id: 'edge', title: 'Kiss the edge', detail: 'Land an on-the-edge stop.', target: 1, rewardCoins: 18, rewardXp: 28 },
  { id: 'great2', title: 'Clean lines', detail: 'Score Beautiful or better twice.', target: 2, rewardCoins: 16, rewardXp: 24 },
  { id: 'clear4', title: 'Long expedition', detail: 'Clear 4 levels in one run.', target: 4, rewardCoins: 22, rewardXp: 32 },
  { id: 'fog', title: 'Fog crossing', detail: 'Pass a level in fog.', target: 1, rewardCoins: 14, rewardXp: 20 },
  { id: 'blizzard', title: 'Whiteout', detail: 'Pass a level in a blizzard.', target: 1, rewardCoins: 16, rewardXp: 22 },
  { id: 'snow', title: 'Fresh powder', detail: 'Pass a level in snow.', target: 1, rewardCoins: 12, rewardXp: 16 },
  { id: 'coins40', title: 'Pay the camp', detail: 'Earn 40 coins in one run.', target: 40, rewardCoins: 12, rewardXp: 18 },
  { id: 'crew5', title: 'Full sled', detail: 'Collect 5 crew members.', target: 5, rewardCoins: 20, rewardXp: 24 },
  { id: 'streak3', title: 'No falls', detail: 'Clear 3 levels in a row this run.', target: 3, rewardCoins: 18, rewardXp: 22 },
  { id: 'level8', title: 'Deep ice', detail: 'Reach level 8.', target: 8, rewardCoins: 24, rewardXp: 36 },
]

const RUN_SCOPED = new Set(['clear4', 'coins40', 'streak3'])

export interface ContractSlot {
  id: string
  progress: number
}

export interface GuestMeta {
  tutorialDone: boolean
  springs: number
  studs: number
  sense: number
  fund: number
  xp: number
  cursor: number
  contracts: ContractSlot[]
  runClears: number
  runStreak: number
}

const META_KEY = 'cg_edge_brake_meta'

export function springMultiplier(rank: number) {
  return 1 + SPRING_STEP * rank
}

export function studMultiplier(rank: number) {
  return 1 + STUD_STEP * rank
}

export function campLevel(xp: number) {
  return 1 + Math.floor(Math.max(0, xp) / CAMP_XP_PER_LEVEL)
}

export function campXpIntoLevel(xp: number) {
  return Math.max(0, xp) % CAMP_XP_PER_LEVEL
}

export function upgradeById(id: UpgradeId) {
  return UPGRADES.find(upgrade => upgrade.id === id) ?? UPGRADES[0]
}

export function contractById(id: string) {
  return CONTRACTS.find(contract => contract.id === id) ?? null
}

export function freshMeta(): GuestMeta {
  return {
    tutorialDone: false,
    springs: 0,
    studs: 0,
    sense: 0,
    fund: 0,
    xp: 0,
    cursor: 4,
    contracts: [
      { id: 'edge', progress: 0 },
      { id: 'clear4', progress: 0 },
      { id: 'fog', progress: 0 },
    ],
    runClears: 0,
    runStreak: 0,
  }
}

function clampRank(value: unknown, max: number) {
  const rank = Math.floor(Number(value))
  if (!Number.isFinite(rank)) return 0
  return Math.min(max, Math.max(0, rank))
}

export function normalizeMeta(input: unknown): GuestMeta {
  const blank = freshMeta()
  if (!input || typeof input !== 'object') return blank
  const raw = input as Partial<GuestMeta>
  const seen = new Set<string>()
  const contracts: ContractSlot[] = []
  if (Array.isArray(raw.contracts)) {
    for (const slot of raw.contracts) {
      if (!slot || typeof slot !== 'object') continue
      const id = String((slot as ContractSlot).id)
      const def = contractById(id)
      if (!def || seen.has(id)) continue
      seen.add(id)
      const progress = Math.max(0, Math.min(def.target, Math.floor(Number((slot as ContractSlot).progress)) || 0))
      contracts.push({ id, progress })
      if (contracts.length === 3) break
    }
  }
  let cursor = Math.max(0, Math.floor(Number(raw.cursor)) || 0)
  while (contracts.length < 3) {
    const picked = pickNext(contracts.map(slot => slot.id), cursor)
    contracts.push({ id: picked.id, progress: 0 })
    cursor = picked.cursor
  }
  return {
    tutorialDone: raw.tutorialDone === true,
    springs: clampRank(raw.springs, 5),
    studs: clampRank(raw.studs, 5),
    sense: clampRank(raw.sense, 3),
    fund: clampRank(raw.fund, 3),
    xp: Math.max(0, Math.floor(Number(raw.xp)) || 0),
    cursor,
    contracts,
    runClears: Math.max(0, Math.floor(Number(raw.runClears)) || 0),
    runStreak: Math.max(0, Math.floor(Number(raw.runStreak)) || 0),
  }
}

export function loadMeta(): GuestMeta {
  try {
    return normalizeMeta(JSON.parse(localStorage.getItem(META_KEY) || 'null'))
  } catch {
    return freshMeta()
  }
}

export function saveMeta(meta: GuestMeta) {
  localStorage.setItem(META_KEY, JSON.stringify(meta))
}

export function resetRunContracts(meta: GuestMeta): GuestMeta {
  return {
    ...meta,
    runClears: 0,
    runStreak: 0,
    contracts: meta.contracts.map(slot => (RUN_SCOPED.has(slot.id) ? { ...slot, progress: 0 } : slot)),
  }
}

export function pickNext(activeIds: string[], cursor: number) {
  for (let offset = 0; offset < CONTRACTS.length; offset += 1) {
    const index = (cursor + offset) % CONTRACTS.length
    const id = CONTRACTS[index].id
    if (!activeIds.includes(id)) return { id, cursor: index + 1 }
  }
  return { id: CONTRACTS[0].id, cursor: cursor + 1 }
}

export function advanceContracts(
  meta: GuestMeta,
  read: (id: string, prev: number) => number,
  seed: (id: string) => number,
) {
  const base = new Map(meta.contracts.map(slot => [slot.id, slot.progress]))
  let working: GuestMeta = { ...meta, contracts: meta.contracts.map(slot => ({ ...slot })) }
  const completed: ContractDef[] = []
  let bonusCoins = 0
  const valueOf = (id: string) => (base.has(id) ? read(id, base.get(id) ?? 0) : seed(id))

  for (let guard = 0; guard < 4; guard += 1) {
    const doneIndex = working.contracts.findIndex(slot => {
      const def = contractById(slot.id)
      return !!def && valueOf(slot.id) >= def.target
    })
    if (doneIndex < 0) {
      working = {
        ...working,
        contracts: working.contracts.map(slot => {
          const def = contractById(slot.id)
          const value = valueOf(slot.id)
          return { ...slot, progress: def ? Math.min(def.target, Math.max(0, value)) : slot.progress }
        }),
      }
      break
    }
    const def = contractById(working.contracts[doneIndex].id)
    if (!def) break
    completed.push(def)
    bonusCoins += def.rewardCoins
    const remaining = working.contracts.filter((_, index) => index !== doneIndex).map(slot => slot.id)
    const picked = pickNext(remaining, working.cursor)
    const contracts = working.contracts.slice()
    contracts[doneIndex] = { id: picked.id, progress: 0 }
    working = { ...working, xp: working.xp + def.rewardXp, cursor: picked.cursor, contracts }
    base.delete(def.id)
  }

  return { meta: working, completed, bonusCoins }
}

export function quoteUpgrade(meta: GuestMeta, id: UpgradeId, coins: number) {
  const def = upgradeById(id)
  const nextRank = meta[id] + 1
  if (nextRank > def.max) return { ok: false, cost: 0, reason: 'max' as const, nextRank }
  const cost = def.costs[nextRank - 1]
  if (campLevel(meta.xp) < nextRank) return { ok: false, cost, reason: 'camp' as const, nextRank }
  if (coins < cost) return { ok: false, cost, reason: 'coins' as const, nextRank }
  return { ok: true, cost, reason: null, nextRank }
}

export function gearSummary(meta: GuestMeta) {
  const parts: string[] = []
  if (meta.springs) parts.push(`Launch +${(SPRING_STEP * meta.springs * 100).toFixed(1)}%`)
  if (meta.studs) parts.push(`Grip +${Math.round(STUD_STEP * meta.studs * 100)}%`)
  if (meta.sense === 1) parts.push('Coarse target')
  if (meta.sense === 2) parts.push('Close target')
  if (meta.sense >= 3) parts.push('Exact target')
  if (meta.fund) parts.push(`+${meta.fund} coin on stop`)
  return parts
}

export const SAVE_KEYS = {
  bestCombo: 'cg_edge_brake_best_combo',
  bestDistance: 'cg_edge_brake_best_distance',
  bestScore: 'cg_edge_brake_best_score',
  coins: 'cg_edge_brake_coins',
  unlocked: 'cg_edge_brake_unlocked',
  character: 'cg_edge_brake_character',
  maxLevel: 'cg_edge_brake_max_level',
  muted: 'cg_edge_brake_muted',
}
