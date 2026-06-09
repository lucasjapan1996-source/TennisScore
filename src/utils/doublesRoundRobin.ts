import type { Match, ScheduleSeedMode } from '../types';
import { buildRotatingDoublesSchedule } from './doublesScheduler';
import { orderByRestAndFairness } from './matchOrder';

export type DoublesSide = readonly [string, string];

export type DoublesMatchup = {
  sideA: DoublesSide;
  sideB: DoublesSide;
};

export function partnershipKey(a: string, b: string): string {
  return a < b ? `${a},${b}` : `${b},${a}`;
}

function sharesPlayer(sideA: DoublesSide, sideB: DoublesSide): boolean {
  return sideA.includes(sideB[0]) || sideA.includes(sideB[1]);
}

/** 所有两人搭档组合 */
export function allPartnerships(playerIds: string[]): DoublesSide[] {
  const pairs: DoublesSide[] = [];
  for (let i = 0; i < playerIds.length; i++) {
    for (let j = i + 1; j < playerIds.length; j++) {
      pairs.push([playerIds[i], playerIds[j]]);
    }
  }
  return pairs;
}

/** 两队搭档互不重复球员时的全部对阵 */
export function allDoublesMatchups(partnerships: DoublesSide[]): DoublesMatchup[] {
  const matches: DoublesMatchup[] = [];
  for (let i = 0; i < partnerships.length; i++) {
    for (let j = i + 1; j < partnerships.length; j++) {
      const sideA = partnerships[i];
      const sideB = partnerships[j];
      if (!sharesPlayer(sideA, sideB)) {
        matches.push({ sideA, sideB });
      }
    }
  }
  return matches;
}

export function matchupKey(m: DoublesMatchup): string {
  const kA = partnershipKey(m.sideA[0], m.sideA[1]);
  const kB = partnershipKey(m.sideB[0], m.sideB[1]);
  return kA < kB ? `${kA}|${kB}` : `${kB}|${kA}`;
}

function partnershipInMatch(m: DoublesMatchup, key: string): boolean {
  const kA = partnershipKey(m.sideA[0], m.sideA[1]);
  const kB = partnershipKey(m.sideB[0], m.sideB[1]);
  return kA === key || kB === key;
}

/**
 * 选取对阵：先尽量让每条搭档只出现一次；再补齐尚未搭档的组合。
 */
export function selectPartnerRoundMatches(playerIds: string[]): DoublesMatchup[] {
  const partnerships = allPartnerships(playerIds);
  const candidates = allDoublesMatchups(partnerships);
  const usedPartnership = new Set<string>();
  const usedMatchup = new Set<string>();
  const selected: DoublesMatchup[] = [];

  const addMatch = (m: DoublesMatchup) => {
    const mk = matchupKey(m);
    if (usedMatchup.has(mk)) return;
    usedMatchup.add(mk);
    selected.push(m);
    usedPartnership.add(partnershipKey(m.sideA[0], m.sideA[1]));
    usedPartnership.add(partnershipKey(m.sideB[0], m.sideB[1]));
  };

  for (const m of candidates) {
    const kA = partnershipKey(m.sideA[0], m.sideA[1]);
    const kB = partnershipKey(m.sideB[0], m.sideB[1]);
    if (usedPartnership.has(kA) || usedPartnership.has(kB)) continue;
    addMatch(m);
  }

  for (const [a, b] of partnerships) {
    const key = partnershipKey(a, b);
    if (usedPartnership.has(key)) continue;
    const pool = candidates.filter((m) => partnershipInMatch(m, key));
    pool.sort((x, y) => {
      const ox = partnershipKey(x.sideA[0], x.sideA[1]) === key
        ? partnershipKey(x.sideB[0], x.sideB[1])
        : partnershipKey(x.sideA[0], x.sideA[1]);
      const oy = partnershipKey(y.sideA[0], y.sideA[1]) === key
        ? partnershipKey(y.sideB[0], y.sideB[1])
        : partnershipKey(y.sideA[0], y.sideA[1]);
      const xNew = usedPartnership.has(ox) ? 1 : 0;
      const yNew = usedPartnership.has(oy) ? 1 : 0;
      return xNew - yNew;
    });
    if (pool.length > 0) addMatch(pool[0]);
  }

  return selected;
}

/** 尽量避免连场，并均衡各人等待时间 */
export function orderDoublesMatchesNoBackToBack(
  matches: DoublesMatchup[],
): DoublesMatchup[] {
  return orderByRestAndFairness(matches, (m) => [...m.sideA, ...m.sideB]);
}

/** 按签位顺序：每 4 人一场 1/2 vs 3/4，下一波 5/6 vs 7/8 */
export function buildSequentialDoublesBlockMatchups(
  playerIds: readonly string[],
): DoublesMatchup[] {
  const blocks: DoublesMatchup[] = [];
  for (let i = 0; i + 3 < playerIds.length; i += 4) {
    blocks.push({
      sideA: [playerIds[i], playerIds[i + 1]],
      sideB: [playerIds[i + 2], playerIds[i + 3]],
    });
  }
  return blocks;
}

/** 按顺序：先排齐相邻四人间对阵，再排其余搭档赛 */
export function orderDoublesMatchesSequentialFirst(
  pool: readonly DoublesMatchup[],
  playerIds: readonly string[],
): DoublesMatchup[] {
  const blocks = buildSequentialDoublesBlockMatchups(playerIds);
  const byKey = new Map(pool.map((m) => [matchupKey(m), m]));
  const first: DoublesMatchup[] = [];
  const used = new Set<string>();
  for (const b of blocks) {
    const hit = byKey.get(matchupKey(b));
    if (hit) {
      first.push(hit);
      used.add(matchupKey(hit));
    }
  }
  const rest = pool.filter((m) => !used.has(matchupKey(m)));
  return [...first, ...orderByRestAndFairness(rest, (m) => [...m.sideA, ...m.sideB])];
}


export function countDoublesPartnerRoundMatches(playerCount: number): number {
  if (playerCount < 4) return 0;
  if (playerCount >= 5 && playerCount % 4 === 1) return playerCount;
  const ids = Array.from({ length: playerCount }, (_, i) => `p${i + 1}`);
  return selectPartnerRoundMatches(ids).length;
}

export function buildDoublesPartnerRoundRobinMatches(
  playerIds: string[],
  createMatch: (
    order: number,
    sideAIds: string[],
    sideBIds: string[],
  ) => Match,
  startOrder = 1,
  seedMode: ScheduleSeedMode = 'random',
): Match[] {
  const matchOrder = buildRotatingDoublesSchedule(playerIds, seedMode);
  return matchOrder.map((m, idx) =>
    createMatch(startOrder + idx, [...m.sideA], [...m.sideB]),
  );
}
