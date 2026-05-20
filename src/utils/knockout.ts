import type {
  GroupAssignment,
  KnockoutSlot,
  KnockoutStage,
  Match,
  MatchMode,
  Player,
  Team,
  Tournament,
} from '../types';
import { S } from '../strings';
import { computeGroupStandings } from './ranking';
import { isMatchPlayed } from './score';
function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function entityKey(ids: string[]): string {
  return [...ids].sort().join(',');
}

export function slotLabel(slot: KnockoutSlot): string {
  if (slot.kind === 'group_rank') {
    return S.knockoutSlotGroupRank(slot.group, slot.rank);
  }
  return slot.kind === 'winner' ? S.knockoutSlotWinner : S.knockoutSlotLoser;
}

export function knockoutStageLabel(stage: KnockoutStage): string {
  switch (stage) {
    case 'cross':
      return S.knockoutCross;
    case 'quarter':
      return S.knockoutQuarter;
    case 'semi':
      return S.knockoutSemi;
    case 'third':
      return S.knockoutThirdLegacy;
    case 'final':
      return S.knockoutFinal;
    case 'bye':
      return S.knockoutBye;
    default:
      return S.knockoutStage;
  }
}

export function knockoutMatchLabel(m: Match): string {
  if (m.isBye) return S.knockoutBye;
  const tier = m.knockoutRank ?? 1;
  if (m.knockoutStage === 'cross') {
    return S.knockoutCrossRank(tier);
  }
  const stage = m.knockoutStage ? knockoutStageLabel(m.knockoutStage) : S.knockoutStage;
  return S.knockoutRankMatch(tier, stage);
}

function getMatchWinnerIds(m: Match): string[] | null {
  if (m.isBye) {
    if (m.sideAIds.length > 0) return m.sideAIds;
    if (m.sideBIds.length > 0) return m.sideBIds;
    return null;
  }
  if (!isMatchPlayed(m) || m.scoreA === null || m.scoreB === null) return null;
  if (m.scoreA > m.scoreB) return m.sideAIds;
  if (m.scoreB > m.scoreA) return m.sideBIds;
  return null;
}

function getMatchLoserIds(m: Match): string[] | null {
  if (m.isBye) return null;
  if (!isMatchPlayed(m) || m.scoreA === null || m.scoreB === null) return null;
  if (m.scoreA > m.scoreB) return m.sideBIds;
  if (m.scoreB > m.scoreA) return m.sideAIds;
  return null;
}

function resolveByeWinnerIds(
  m: Match,
  tournament: Pick<Tournament, 'matches' | 'mode' | 'players' | 'teams' | 'groups'>,
): string[] | null {
  if (!m.isBye) return null;
  if (m.sideAIds.length > 0) return m.sideAIds;
  if (m.sideBIds.length > 0) return m.sideBIds;
  if (m.slotA) return resolveSlot(m.slotA, tournament);
  if (m.slotB) return resolveSlot(m.slotB, tournament);
  return null;
}

function resolveSlot(
  slot: KnockoutSlot,
  tournament: Pick<Tournament, 'matches' | 'mode' | 'players' | 'teams' | 'groups'>,
): string[] | null {
  if (slot.kind === 'group_rank') {
    const standings = computeGroupStandings(
      slot.group,
      tournament.mode,
      tournament.players,
      tournament.teams,
      tournament.groups,
      tournament.matches,
    );
    const row = standings.find((r) => r.rank === slot.rank);
    if (!row) return null;
    if (tournament.mode === 'singles') return [row.id];
    const team = tournament.teams.find(
      (t) => t.id === row.id || entityKey(t.playerIds) === row.id,
    );
    return team ? [...team.playerIds] : null;
  }

  const ref = tournament.matches.find((x) => x.id === slot.matchId);
  if (!ref) return null;
  if (ref.isBye) {
    return resolveByeWinnerIds(ref, tournament);
  }
  return slot.kind === 'winner'
    ? getMatchWinnerIds(ref)
    : getMatchLoserIds(ref);
}

export function isGroupStageCompleteForKnockout(
  tournament: Pick<Tournament, 'matches' | 'groups' | 'scheduleFormat'>,
): boolean {
  if (tournament.scheduleFormat === 'knockout') return true;
  const groupMatches = tournament.matches.filter((m) => m.phase === 'group');
  return groupMatches.length > 0 && groupMatches.every((m) => isMatchPlayed(m));
}

function resolveKnockoutSideIds(
  m: Match,
  side: 'A' | 'B',
  tournament: Pick<Tournament, 'matches' | 'mode' | 'players' | 'teams' | 'groups'>,
): string[] | null {
  const ids = side === 'A' ? m.sideAIds : m.sideBIds;
  const slot = side === 'A' ? m.slotA : m.slotB;
  if (ids.length > 0) return ids;
  if (slot) return resolveSlot(slot, tournament);
  return null;
}

export function isKnockoutMatchReady(
  m: Match,
  tournament: Pick<
    Tournament,
    'matches' | 'mode' | 'players' | 'teams' | 'groups' | 'scheduleFormat'
  >,
): boolean {
  if (m.phase !== 'knockout') return true;
  if (m.isBye) return true;
  if (!isGroupStageCompleteForKnockout(tournament)) return false;
  return (
    resolveKnockoutSideIds(m, 'A', tournament) !== null &&
    resolveKnockoutSideIds(m, 'B', tournament) !== null
  );
}

export interface ResolvedMatchSides {
  sideAIds: string[];
  sideBIds: string[];
  labelA: string;
  labelB: string;
  ready: boolean;
  waitingReason: string | null;
}

export function resolveMatchSides(
  m: Match,
  tournament: Pick<
    Tournament,
    'matches' | 'mode' | 'players' | 'teams' | 'groups' | 'scheduleFormat'
  >,
  formatLabel: (ids: string[], players: Player[]) => string,
): ResolvedMatchSides {
  if (m.phase === 'group') {
    return {
      sideAIds: m.sideAIds,
      sideBIds: m.sideBIds,
      labelA: formatLabel(m.sideAIds, tournament.players),
      labelB: formatLabel(m.sideBIds, tournament.players),
      ready: true,
      waitingReason: null,
    };
  }

  if (m.isBye) {
    const winnerIds =
      m.sideAIds.length > 0 ? m.sideAIds : m.sideBIds.length > 0 ? m.sideBIds : null;
    const winnerLabel = winnerIds
      ? formatLabel(winnerIds, tournament.players)
      : m.slotA
        ? slotLabel(m.slotA)
        : m.slotB
          ? slotLabel(m.slotB)
          : '?';
    return {
      sideAIds: winnerIds ?? [],
      sideBIds: [],
      labelA: winnerLabel,
      labelB: S.knockoutByeShort,
      ready: true,
      waitingReason: null,
    };
  }

  if (!isGroupStageCompleteForKnockout(tournament)) {
    return {
      sideAIds: [],
      sideBIds: [],
      labelA: m.slotA ? slotLabel(m.slotA) : '?',
      labelB: m.slotB ? slotLabel(m.slotB) : '?',
      ready: false,
      waitingReason: S.knockoutWaitGroup,
    };
  }

  const sideAIds = resolveKnockoutSideIds(m, 'A', tournament);
  const sideBIds = resolveKnockoutSideIds(m, 'B', tournament);
  const labelA = sideAIds
    ? formatLabel(sideAIds, tournament.players)
    : m.slotA
      ? slotLabel(m.slotA)
      : '?';
  const labelB = sideBIds
    ? formatLabel(sideBIds, tournament.players)
    : m.slotB
      ? slotLabel(m.slotB)
      : '?';

  if (!sideAIds || !sideBIds) {
    return {
      sideAIds: sideAIds ?? [],
      sideBIds: sideBIds ?? [],
      labelA,
      labelB,
      ready: false,
      waitingReason: S.knockoutWaitPrior,
    };
  }

  return {
    sideAIds,
    sideBIds,
    labelA,
    labelB,
    ready: true,
    waitingReason: null,
  };
}

export function nextPowerOfTwo(n: number): number {
  let p = 2;
  while (p < n) p *= 2;
  return p;
}

/** 单档淘汰赛签表场次数（含轮空，网球仅决冠亚军无季军赛） */
export function countBracketMatches(entrantCount: number): number {
  if (entrantCount < 2) return 0;
  const size = nextPowerOfTwo(entrantCount);
  return size - 1;
}

export function countKnockoutMatches(
  groupCount: number,
  minGroupSize: number,
): number {
  if (groupCount < 2 || minGroupSize < 1) return 0;
  return minGroupSize * countBracketMatches(groupCount);
}

export function countPureKnockoutMatches(entityCount: number): number {
  return countBracketMatches(entityCount);
}

type BracketEntrant =
  | { kind: 'sides'; sideIds: string[] }
  | { kind: 'slot'; slot: KnockoutSlot }
  | { kind: 'winner'; matchId: string }
  | { kind: 'loser'; matchId: string };

function padWithRandomByes<T>(entries: T[]): (T | null)[] {
  const size = nextPowerOfTwo(Math.max(2, entries.length));
  const slots: (T | null)[] = Array(size).fill(null);
  const positions = shuffle([...Array(size).keys()]);
  entries.forEach((entry, i) => {
    slots[positions[i]] = entry;
  });
  return slots;
}

function stageForBracketRound(roundSize: number): KnockoutStage {
  if (roundSize <= 2) return 'final';
  if (roundSize === 4) return 'semi';
  return 'quarter';
}

function createKnockoutAdd(matches: Match[], startOrder: number) {
  let order = startOrder;
  return (
    stage: KnockoutStage,
    rankTier: number,
    slotA: KnockoutSlot | null,
    slotB: KnockoutSlot | null,
    sideAIds: string[] = [],
    sideBIds: string[] = [],
    isBye = false,
  ): Match => {
    const m: Match = {
      id: crypto.randomUUID(),
      phase: 'knockout',
      group: null,
      knockoutStage: stage,
      knockoutRank: rankTier,
      slotA,
      slotB,
      order: order++,
      sideAIds,
      sideBIds,
      scoreA: isBye ? 1 : null,
      scoreB: isBye ? 0 : null,
      tiebreakA: 0,
      tiebreakB: 0,
      playedAt: isBye ? new Date().toISOString() : null,
      isBye,
    };
    matches.push(m);
    return m;
  };
}

function entrantToSlot(e: BracketEntrant): KnockoutSlot | null {
  if (e.kind === 'slot') return e.slot;
  if (e.kind === 'winner' || e.kind === 'loser') return e;
  return null;
}

function entrantToSides(e: BracketEntrant): string[] {
  if (e.kind === 'sides') return e.sideIds;
  return [];
}

function addByeAdvance(
  add: ReturnType<typeof createKnockoutAdd>,
  rankTier: number,
  entrant: BracketEntrant,
): Match {
  if (entrant.kind === 'sides') {
    return add('bye', rankTier, null, null, entrant.sideIds, [], true);
  }
  if (entrant.kind === 'slot') {
    return add('bye', rankTier, entrant.slot, null, [], [], true);
  }
  throw new Error('bye advance requires sides or slot entrant');
}

function addPairMatch(
  add: ReturnType<typeof createKnockoutAdd>,
  rankTier: number,
  stage: KnockoutStage,
  a: BracketEntrant,
  b: BracketEntrant,
): Match {
  return add(
    stage,
    rankTier,
    entrantToSlot(a),
    entrantToSlot(b),
    entrantToSides(a),
    entrantToSides(b),
  );
}

function buildEliminationBracket(
  entrants: Array<
    { kind: 'sides'; sideIds: string[] } | { kind: 'slot'; slot: KnockoutSlot }
  >,
  rankTier: number,
  add: ReturnType<typeof createKnockoutAdd>,
): void {
  if (entrants.length === 2) {
    const stage = entrants[0].kind === 'slot' ? 'cross' : 'final';
    addPairMatch(add, rankTier, stage, entrants[0], entrants[1]);
    return;
  }

  let current: (BracketEntrant | null)[] = padWithRandomByes(entrants);

  while (current.length > 1) {
    if (current.length === 2) {
      const a = current[0]!;
      const b = current[1]!;
      const semiA =
        a.kind === 'winner' || a.kind === 'loser' ? a : null;
      const semiB =
        b.kind === 'winner' || b.kind === 'loser' ? b : null;
      if (semiA && semiB) {
        add('final', rankTier, semiA, semiB);
      } else {
        addPairMatch(add, rankTier, 'final', a, b);
      }
      return;
    }

    const next: BracketEntrant[] = [];
    const stage = stageForBracketRound(current.length);

    for (let i = 0; i < current.length; i += 2) {
      const a = current[i];
      const b = current[i + 1];
      if (!a && !b) continue;
      if (a && !b) {
        const byeM = addByeAdvance(add, rankTier, a);
        next.push({ kind: 'winner', matchId: byeM.id });
        continue;
      }
      if (!a && b) {
        const byeM = addByeAdvance(add, rankTier, b);
        next.push({ kind: 'winner', matchId: byeM.id });
        continue;
      }
      const m = addPairMatch(add, rankTier, stage, a!, b!);
      next.push({ kind: 'winner', matchId: m.id });
    }
    current = next;
  }
}

export function buildPureKnockoutSchedule(
  players: Player[],
  teams: Team[],
  mode: MatchMode,
): { matches: Match[]; nextOrder: number } {
  const entrants =
    mode === 'singles'
      ? shuffle(players).map((p) => ({
          kind: 'sides' as const,
          sideIds: [p.id],
        }))
      : shuffle(teams).map((t) => ({
          kind: 'sides' as const,
          sideIds: [...t.playerIds],
        }));

  const matches: Match[] = [];
  const add = createKnockoutAdd(matches, 1);
  buildEliminationBracket(entrants, 1, add);
  return { matches, nextOrder: matches.length + 1 };
}

function maxKnockoutRank(groups: GroupAssignment[]): number {
  if (groups.length === 0) return 0;
  return Math.min(...groups.map((g) => g.memberIds.length));
}

function buildKnockoutForRank(
  rank: number,
  groups: GroupAssignment[],
  add: ReturnType<typeof createKnockoutAdd>,
): void {
  const sorted = [...groups].sort((a, b) => a.id - b.id);
  const entrants = sorted.map((g) => ({
    kind: 'slot' as const,
    slot: { kind: 'group_rank' as const, group: g.id, rank },
  }));
  buildEliminationBracket(entrants, rank, add);
}

export function buildKnockoutMatches(
  groups: GroupAssignment[],
  startOrder: number,
): { matches: Match[]; nextOrder: number } {
  const matches: Match[] = [];
  const add = createKnockoutAdd(matches, startOrder);

  const maxRank = maxKnockoutRank(groups);
  for (let r = 1; r <= maxRank; r++) {
    buildKnockoutForRank(r, groups, add);
  }

  return { matches, nextOrder: startOrder + matches.length };
}

export function getTournamentChampion(
  tournament: Pick<
    Tournament,
    'matches' | 'mode' | 'players' | 'teams' | 'groups' | 'scheduleFormat'
  >,
  formatLabel: (ids: string[], players: Player[]) => string,
): string | null {
  if (
    tournament.scheduleFormat !== 'group_stage' &&
    tournament.scheduleFormat !== 'knockout'
  ) {
    return null;
  }
  const titleMatch = tournament.matches.find(
    (m) =>
      m.phase === 'knockout' &&
      m.knockoutRank === 1 &&
      (m.knockoutStage === 'final' || m.knockoutStage === 'cross'),
  );
  if (!titleMatch || !isMatchPlayed(titleMatch)) return null;
  const resolved = resolveMatchSides(titleMatch, tournament, formatLabel);
  if (!resolved.ready) return null;
  return titleMatch.scoreA !== null &&
    titleMatch.scoreB !== null &&
    titleMatch.scoreA > titleMatch.scoreB
    ? resolved.labelA
    : resolved.labelB;
}
