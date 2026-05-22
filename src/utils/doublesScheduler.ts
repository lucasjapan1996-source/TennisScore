/**
 * 业余双打排程：加权软约束，追求公平与自然轮换，不追求数学完美。
 */

import type { ScheduleSeedMode } from '../types';
import type { DoublesMatchup } from './doublesRoundRobin';
import {
  allDoublesMatchups,
  allPartnerships,
  matchupKey,
  partnershipKey,
  selectPartnerRoundMatches,
} from './doublesRoundRobin';

/** 球员排程状态 */
export type PlayerScheduleState = {
  id: string;
  orderIndex: number;
  matchCount: number;
  lastSlot: number;
};

/** 全局排程状态 */
export type DoublesScheduleState = {
  players: Map<string, PlayerScheduleState>;
  teammateCounts: Map<string, number>;
  opponentCounts: Map<string, number>;
  slot: number;
};

export type ScheduledDoublesRound = {
  roundIndex: number;
  matches: DoublesMatchup[];
};

/** 软约束权重（越大 = 该因素对总分影响越强） */
export const SOFT_WEIGHTS = {
  matchCount: 55,
  restMin: 42,
  restMax: 14,
  backToBack: 75,
  shortRest: 18,
  teammate: 28,
  opponent: 18,
  sequentialWave: 16,
} as const;

export type MatchScoreBreakdown = {
  total: number;
  matchCountPenalty: number;
  restBonus: number;
  backToBackPenalty: number;
  shortRestPenalty: number;
  teammatePenalty: number;
  opponentPenalty: number;
  sequentialBonus: number;
};

export function createDoublesScheduleState(
  playerIds: readonly string[],
): DoublesScheduleState {
  const players = new Map<string, PlayerScheduleState>();
  playerIds.forEach((id, index) => {
    players.set(id, {
      id,
      orderIndex: index,
      matchCount: 0,
      lastSlot: -1,
    });
  });
  return {
    players,
    teammateCounts: new Map(),
    opponentCounts: new Map(),
    slot: 0,
  };
}

function participantsOf(m: DoublesMatchup): string[] {
  return [...m.sideA, ...m.sideB];
}

function bumpTeammate(state: DoublesScheduleState, a: string, b: string): void {
  const k = partnershipKey(a, b);
  state.teammateCounts.set(k, (state.teammateCounts.get(k) ?? 0) + 1);
}

function bumpOpponent(state: DoublesScheduleState, a: string, b: string): void {
  const k = partnershipKey(a, b);
  state.opponentCounts.set(k, (state.opponentCounts.get(k) ?? 0) + 1);
}

export function applyMatchToScheduleState(
  state: DoublesScheduleState,
  m: DoublesMatchup,
  options?: { slotOverride?: number; advanceSlot?: boolean },
): void {
  const slot = options?.slotOverride ?? state.slot;
  for (const id of participantsOf(m)) {
    const p = state.players.get(id);
    if (!p) continue;
    p.matchCount++;
    p.lastSlot = slot;
  }
  bumpTeammate(state, m.sideA[0], m.sideA[1]);
  bumpTeammate(state, m.sideB[0], m.sideB[1]);
  for (const a of m.sideA) {
    for (const b of m.sideB) {
      bumpOpponent(state, a, b);
    }
  }
  if (options?.advanceSlot !== false) {
    state.slot++;
  }
}

/** 顺序模式：相邻四人一场 (1/2 vs 3/4, …) */
export function buildSequentialDoublesWaves(
  playerIds: readonly string[],
): DoublesMatchup[] {
  const waves: DoublesMatchup[] = [];
  for (let i = 0; i + 3 < playerIds.length; i += 4) {
    waves.push({
      sideA: [playerIds[i], playerIds[i + 1]],
      sideB: [playerIds[i + 2], playerIds[i + 3]],
    });
  }
  return waves;
}

const waveKeySetCache = new WeakMap<readonly string[], Set<string>>();

function waveKeySet(playerIds: readonly string[]): Set<string> {
  let cached = waveKeySetCache.get(playerIds);
  if (!cached) {
    cached = new Set(
      buildSequentialDoublesWaves(playerIds).map(matchupKey),
    );
    waveKeySetCache.set(playerIds, cached);
  }
  return cached;
}

function sequentialAffinityBonus(
  state: DoublesScheduleState,
  m: DoublesMatchup,
): number {
  const sideASpan = Math.abs(
    (state.players.get(m.sideA[0])?.orderIndex ?? 0) -
      (state.players.get(m.sideA[1])?.orderIndex ?? 0),
  );
  const sideBSpan = Math.abs(
    (state.players.get(m.sideB[0])?.orderIndex ?? 0) -
      (state.players.get(m.sideB[1])?.orderIndex ?? 0),
  );
  const indices = participantsOf(m).map(
    (id) => state.players.get(id)?.orderIndex ?? 0,
  );
  indices.sort((a, b) => a - b);
  const span = (indices[indices.length - 1] ?? 0) - (indices[0] ?? 0);
  return (
    SOFT_WEIGHTS.sequentialWave *
    (0.4 * (sideASpan === 1 ? 1 : 0) +
      0.4 * (sideBSpan === 1 ? 1 : 0) +
      0.2 * Math.max(0, 5 - span))
  );
}

/**
 * 软约束打分（越高越优先）。允许多目标权衡，无硬拒绝。
 */
export function scoreDoublesMatch(
  state: DoublesScheduleState,
  m: DoublesMatchup,
  options?: { sequential?: boolean; playerIds?: readonly string[] },
): number {
  return scoreDoublesMatchDetailed(state, m, options).total;
}

export function scoreDoublesMatchDetailed(
  state: DoublesScheduleState,
  m: DoublesMatchup,
  options?: { sequential?: boolean; playerIds?: readonly string[] },
): MatchScoreBreakdown {
  const ids = participantsOf(m);
  const slot = state.slot;
  const avgCount =
    ids.reduce((s, id) => s + (state.players.get(id)?.matchCount ?? 0), 0) /
    ids.length;

  let minRest = Number.POSITIVE_INFINITY;
  let maxRest = 0;
  let backToBackPlayers = 0;
  let shortRestPlayers = 0;

  for (const id of ids) {
    const p = state.players.get(id);
    if (!p) continue;
    if (p.lastSlot < 0) {
      minRest = Math.min(minRest, slot + 3);
      maxRest = Math.max(maxRest, slot + 3);
    } else {
      const gap = slot - p.lastSlot;
      if (gap <= 1) backToBackPlayers++;
      else if (gap === 2) shortRestPlayers++;
      minRest = Math.min(minRest, gap);
      maxRest = Math.max(maxRest, gap);
    }
  }

  if (!Number.isFinite(minRest)) {
    minRest = slot + 3;
    maxRest = slot + 3;
  }

  const matchCountPenalty =
    SOFT_WEIGHTS.matchCount *
    ids.reduce((s, id) => {
      const c = state.players.get(id)?.matchCount ?? 0;
      return s + Math.max(0, c - avgCount + 0.5);
    }, 0);

  const restBonus =
    SOFT_WEIGHTS.restMin * minRest + SOFT_WEIGHTS.restMax * maxRest;

  const backToBackPenalty = SOFT_WEIGHTS.backToBack * backToBackPlayers;
  const shortRestPenalty = SOFT_WEIGHTS.shortRest * shortRestPlayers;

  const tA = partnershipKey(m.sideA[0], m.sideA[1]);
  const tB = partnershipKey(m.sideB[0], m.sideB[1]);
  const teammatePenalty =
    SOFT_WEIGHTS.teammate *
    ((state.teammateCounts.get(tA) ?? 0) +
      (state.teammateCounts.get(tB) ?? 0));

  let opponentPenalty = 0;
  for (const a of m.sideA) {
    for (const b of m.sideB) {
      opponentPenalty +=
        SOFT_WEIGHTS.opponent * (state.opponentCounts.get(partnershipKey(a, b)) ?? 0);
    }
  }

  let sequentialBonus = 0;
  if (options?.sequential) {
    sequentialBonus += sequentialAffinityBonus(state, m);
    const pids = options.playerIds;
    if (pids && waveKeySet(pids).has(matchupKey(m))) {
      sequentialBonus +=
        SOFT_WEIGHTS.sequentialWave * Math.max(0, 14 - state.slot);
    }
  }

  const total =
    restBonus +
    sequentialBonus -
    matchCountPenalty -
    backToBackPenalty -
    shortRestPenalty -
    teammatePenalty -
    opponentPenalty;

  return {
    total,
    matchCountPenalty,
    restBonus,
    backToBackPenalty,
    shortRestPenalty,
    teammatePenalty,
    opponentPenalty,
    sequentialBonus,
  };
}

function pickBestMatch(
  pool: readonly DoublesMatchup[],
  state: DoublesScheduleState,
  options: { sequential: boolean; playerIds: readonly string[] },
): number {
  let bestIdx = 0;
  let bestScore = -Infinity;
  for (let i = 0; i < pool.length; i++) {
    const s = scoreDoublesMatch(state, pool[i], options);
    if (s > bestScore) {
      bestScore = s;
      bestIdx = i;
    }
  }
  return bestIdx;
}

export function buildDoublesCandidatePool(
  playerIds: readonly string[],
  maxExtra = 80,
): DoublesMatchup[] {
  const base = selectPartnerRoundMatches([...playerIds]);
  const baseKeys = new Set(base.map(matchupKey));
  const partnerships = allPartnerships([...playerIds]);
  const all = allDoublesMatchups(partnerships);
  const extra: DoublesMatchup[] = [];
  for (const m of all) {
    if (baseKeys.has(matchupKey(m))) continue;
    extra.push(m);
    if (extra.length >= maxExtra) break;
  }
  return [...base, ...extra];
}

/** 轻量局部优化：仅接受能提升总软分的相邻交换 */
function refineTimelineSoft(
  timeline: DoublesMatchup[],
  playerIds: readonly string[],
  seedMode: ScheduleSeedMode,
  pinThrough = 0,
): DoublesMatchup[] {
  const arr = [...timeline];
  const opts = {
    sequential: seedMode === 'sequential',
    playerIds,
  };

  const totalScore = (list: DoublesMatchup[]) => {
    const st = createDoublesScheduleState(playerIds);
    let sum = 0;
    for (const m of list) {
      sum += scoreDoublesMatch(st, m, opts);
      applyMatchToScheduleState(st, m, { advanceSlot: true });
    }
    return sum;
  };

  let best = totalScore(arr);
  for (let pass = 0; pass < arr.length; pass++) {
    let improved = false;
    for (let i = Math.max(0, pinThrough); i < arr.length - 1; i++) {
      const trial = [...arr];
      [trial[i], trial[i + 1]] = [trial[i + 1], trial[i]];
      const s = totalScore(trial);
      if (s > best) {
        best = s;
        arr.splice(0, arr.length, ...trial);
        improved = true;
      }
    }
    if (!improved) break;
  }
  return arr;
}

/** 顺序模式：相邻四人波次，固定顺序、不参与局部交换 */
function sequentialPrefixMatchups(
  playerIds: readonly string[],
  candidates: readonly DoublesMatchup[],
): DoublesMatchup[] {
  const candidateKeys = new Set(candidates.map(matchupKey));
  return buildSequentialDoublesWaves(playerIds).filter((m) =>
    candidateKeys.has(matchupKey(m)),
  );
}

export function scheduleDoublesTimeline(
  candidates: readonly DoublesMatchup[],
  playerIds: readonly string[],
  seedMode: ScheduleSeedMode,
): DoublesMatchup[] {
  const state = createDoublesScheduleState(playerIds);
  const remaining = [...candidates];
  const ordered: DoublesMatchup[] = [];
  const opts = {
    sequential: seedMode === 'sequential',
    playerIds,
  };

  while (remaining.length > 0) {
    const pick = pickBestMatch(remaining, state, opts);
    const [m] = remaining.splice(pick, 1);
    ordered.push(m);
    applyMatchToScheduleState(state, m, { advanceSlot: true });
  }

  const pin =
    seedMode === 'sequential'
      ? sequentialPrefixMatchups(playerIds, candidates).length
      : 0;
  return refineTimelineSoft(ordered, playerIds, seedMode, pin);
}

export function scheduleDoublesByRounds(
  candidates: readonly DoublesMatchup[],
  playerIds: readonly string[],
  seedMode: ScheduleSeedMode,
): { rounds: ScheduledDoublesRound[]; timeline: DoublesMatchup[] } {
  const state = createDoublesScheduleState(playerIds);
  const prefix =
    seedMode === 'sequential'
      ? sequentialPrefixMatchups(playerIds, candidates)
      : [];
  const usedPrefix = new Set(prefix.map(matchupKey));
  let remaining = candidates.filter((m) => !usedPrefix.has(matchupKey(m)));
  const rounds: ScheduledDoublesRound[] = [];
  const timeline: DoublesMatchup[] = [...prefix];
  const opts = {
    sequential: seedMode === 'sequential',
    playerIds,
  };
  let roundIndex = 0;

  for (const m of prefix) {
    applyMatchToScheduleState(state, m, { advanceSlot: true });
  }
  if (prefix.length > 0) {
    rounds.push({ roundIndex: roundIndex++, matches: [...prefix] });
  }

  while (remaining.length > 0) {
    const roundMatches: DoublesMatchup[] = [];
    const busy = new Set<string>();

    while (true) {
      let bestIdx = -1;
      let bestScore = -Infinity;
      for (let i = 0; i < remaining.length; i++) {
        const ids = participantsOf(remaining[i]);
        if (ids.some((id) => busy.has(id))) continue;
        const s = scoreDoublesMatch(state, remaining[i], opts);
        if (s > bestScore) {
          bestScore = s;
          bestIdx = i;
        }
      }
      if (bestIdx < 0) break;
      const [m] = remaining.splice(bestIdx, 1);
      roundMatches.push(m);
      for (const id of participantsOf(m)) busy.add(id);
      timeline.push(m);
    }

    if (roundMatches.length === 0) {
      const pick = pickBestMatch(remaining, state, opts);
      const [m] = remaining.splice(pick, 1);
      roundMatches.push(m);
      timeline.push(m);
    }

    const roundSlot = state.slot;
    for (const m of roundMatches) {
      applyMatchToScheduleState(state, m, {
        slotOverride: roundSlot,
        advanceSlot: false,
      });
    }
    state.slot++;

    rounds.push({ roundIndex: roundIndex++, matches: roundMatches });
  }

  return {
    rounds,
    timeline: refineTimelineSoft(timeline, playerIds, seedMode, prefix.length),
  };
}

export type RotatingDoublesScheduleOptions = {
  expandPool?: boolean;
};

export function buildRotatingDoublesSchedule(
  playerIds: readonly string[],
  seedMode: ScheduleSeedMode,
  options: RotatingDoublesScheduleOptions = {},
): DoublesMatchup[] {
  if (playerIds.length < 4) return [];
  const ordered =
    seedMode === 'random'
      ? shuffleIds([...playerIds])
      : [...playerIds];
  const pool = options.expandPool
    ? buildDoublesCandidatePool(ordered)
    : selectPartnerRoundMatches([...ordered]);
  return scheduleDoublesByRounds(pool, ordered, seedMode).timeline;
}

function shuffleIds(ids: string[]): string[] {
  const a = [...ids];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export type DoublesScheduleQuality = {
  backToBackCount: number;
  shortRestCount: number;
  maxTeammateRepeat: number;
  maxOpponentRepeat: number;
  matchCountSpread: number;
  averageRestGap: number;
};

export function evaluateScheduleQuality(
  timeline: readonly DoublesMatchup[],
  playerIds: readonly string[],
): DoublesScheduleQuality {
  const state = createDoublesScheduleState(playerIds);
  let backToBackCount = 0;
  let shortRestCount = 0;
  const gaps: number[] = [];

  for (const m of timeline) {
    for (const id of participantsOf(m)) {
      const p = state.players.get(id);
      if (p && p.lastSlot >= 0) {
        const gap = state.slot - p.lastSlot;
        gaps.push(gap);
        if (gap <= 1) backToBackCount++;
        else if (gap === 2) shortRestCount++;
      }
    }
    applyMatchToScheduleState(state, m);
  }

  const counts = [...state.players.values()].map((p) => p.matchCount);
  const spread =
    counts.length > 0 ? Math.max(...counts) - Math.min(...counts) : 0;
  const averageRestGap =
    gaps.length > 0 ? gaps.reduce((a, b) => a + b, 0) / gaps.length : 0;

  return {
    backToBackCount,
    shortRestCount,
    maxTeammateRepeat: Math.max(0, ...state.teammateCounts.values()),
    maxOpponentRepeat: Math.max(0, ...state.opponentCounts.values()),
    matchCountSpread: spread,
    averageRestGap,
  };
}
