import type { Match } from '../types';

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

function matchupKey(m: DoublesMatchup): string {
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

/** 尽量避免同一球员连续上场 */
export function orderDoublesMatchesNoBackToBack(
  matches: DoublesMatchup[],
): DoublesMatchup[] {
  const remaining = [...matches];
  const ordered: DoublesMatchup[] = [];
  let last = new Set<string>();

  while (remaining.length > 0) {
    let pick = 0;
    let bestConflict = Infinity;
    for (let i = 0; i < remaining.length; i++) {
      const ids = new Set([
        ...remaining[i].sideA,
        ...remaining[i].sideB,
      ]);
      const conflict = [...ids].filter((id) => last.has(id)).length;
      if (conflict < bestConflict) {
        bestConflict = conflict;
        pick = i;
        if (conflict === 0) break;
      }
    }
    const m = remaining.splice(pick, 1)[0];
    ordered.push(m);
    last = new Set([...m.sideA, ...m.sideB]);
  }

  return ordered;
}

export function countDoublesPartnerRoundMatches(playerCount: number): number {
  if (playerCount < 4) return 0;
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
): Match[] {
  const selected = selectPartnerRoundMatches(playerIds);
  const matchOrder = orderDoublesMatchesNoBackToBack(selected);
  return matchOrder.map((m, idx) =>
    createMatch(startOrder + idx, [...m.sideA], [...m.sideB]),
  );
}
