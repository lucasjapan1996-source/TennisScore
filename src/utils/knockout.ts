import type {
  GroupAssignment,
  KnockoutSlot,
  KnockoutStage,
  Match,
  MatchMode,
  Player,
  Team,
  ScheduleSeedMode,
  Tournament,
} from '../types';
import { orderEntities } from './schedule';
import { getActiveStrings } from '../i18n';
import { computeGroupStandings } from './ranking';
import { getMatchWinnerSide, winnerIdsForSide } from './matchOutcome';
import { resolveMatchBestOf } from './bestOf';
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
    return getActiveStrings().knockoutSlotGroupRank(slot.group, slot.rank);
  }
  return slot.kind === 'winner' ? getActiveStrings().knockoutSlotWinner : getActiveStrings().knockoutSlotLoser;
}

export function knockoutStageLabel(stage: KnockoutStage): string {
  switch (stage) {
    case 'cross':
      return getActiveStrings().knockoutCross;
    case 'quarter':
      return getActiveStrings().knockoutQuarter;
    case 'semi':
      return getActiveStrings().knockoutSemi;
    case 'third':
      return getActiveStrings().knockoutThirdLegacy;
    case 'final':
      return getActiveStrings().knockoutFinal;
    case 'bye':
      return getActiveStrings().knockoutBye;
    default:
      return getActiveStrings().knockoutStage;
  }
}

/** 淘汰赛按轮次分组（纯淘汰赛 UI 用） */
export function groupKnockoutMatchesByRound(
  matches: readonly Match[],
): { round: number; matches: Match[] }[] {
  const map = new Map<number, Match[]>();
  for (const m of matches) {
    if (m.phase !== 'knockout') continue;
    const round = m.knockoutRound ?? 0;
    const list = map.get(round) ?? [];
    list.push(m);
    map.set(round, list);
  }
  return [...map.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([round, list]) => ({
      round,
      matches: [...list].sort((a, b) => a.order - b.order),
    }));
}

export function knockoutRoundSectionTitle(
  round: number,
  sample: Match,
): string {
  const S = getActiveStrings();
  if (sample.knockoutStage === 'final') return S.knockoutFinal;
  if (sample.knockoutStage === 'semi' || sample.isBye) {
    return S.knockoutSemi;
  }
  return S.knockoutRoundLabel(round);
}

export function formatKnockoutByeLine(winnerLabel: string): string {
  return getActiveStrings().knockoutPlayerBye(winnerLabel);
}

export function knockoutMatchLabel(m: Match): string {
  if (m.isBye) return getActiveStrings().knockoutBye;
  if (m.knockoutStage === 'cross') {
    return getActiveStrings().knockoutCrossRank(m.knockoutRank ?? 1);
  }
  const stage = m.knockoutStage
    ? knockoutStageLabel(m.knockoutStage)
    : getActiveStrings().knockoutStage;
  return getActiveStrings().knockoutRankMatch(m.knockoutRank ?? 1, stage);
}

function getMatchWinnerIds(m: Match, tournament: KnockoutResolveTournament): string[] | null {
  if (m.isBye) {
    if (m.sideAIds.length > 0) return m.sideAIds;
    if (m.sideBIds.length > 0) return m.sideBIds;
    return null;
  }
  const bestOf = resolveMatchBestOf(m, tournament);
  const side = getMatchWinnerSide(m, bestOf);
  if (!side) return null;
  return winnerIdsForSide(m, side);
}

function getMatchLoserIds(m: Match, tournament: KnockoutResolveTournament): string[] | null {
  if (m.isBye) return null;
  const bestOf = resolveMatchBestOf(m, tournament);
  const winner = getMatchWinnerSide(m, bestOf);
  if (!winner) return null;
  const loser = winner === 'A' ? 'B' : 'A';
  return winnerIdsForSide(m, loser);
}

export type KnockoutResolveTournament = Pick<
  Tournament,
  | 'matches'
  | 'mode'
  | 'doublesPairing'
  | 'players'
  | 'teams'
  | 'groups'
  | 'category'
  | 'scheduleFormat'
  | 'bestOfMode'
  | 'bestOf'
  | 'customBestOfDefault'
  | 'customBestOfFinal'
>;

function resolveByeWinnerIds(
  m: Match,
  tournament: KnockoutResolveTournament,
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
  tournament: KnockoutResolveTournament,
): string[] | null {
  if (slot.kind === 'group_rank') {
    const standings = computeGroupStandings(
      slot.group,
      tournament.mode,
      tournament.players,
      tournament.teams,
      tournament.groups,
      tournament.matches,
      tournament,
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
    ? getMatchWinnerIds(ref, tournament)
    : getMatchLoserIds(ref, tournament);
}

export function isGroupStageCompleteForKnockout(
  tournament: Pick<Tournament, 'matches' | 'groups' | 'scheduleFormat'>,
): boolean {
  if (tournament.scheduleFormat === 'knockout') return true;
  const groupMatches = tournament.matches.filter((m) => m.phase === 'group');
  return groupMatches.length > 0 && groupMatches.every((m) => isMatchPlayed(m));
}

export function resolveKnockoutSideIds(
  m: Match,
  side: 'A' | 'B',
  tournament: KnockoutResolveTournament,
): string[] | null {
  const ids = side === 'A' ? m.sideAIds : m.sideBIds;
  const slot = side === 'A' ? m.slotA : m.slotB;
  if (ids.length > 0) return ids;
  if (slot) return resolveSlot(slot, tournament);
  return null;
}

export function isKnockoutMatchReady(
  m: Match,
  tournament: ResolveSidesTournament,
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

export type ResolveSidesTournament = KnockoutResolveTournament &
  Pick<Tournament, 'scheduleFormat'>;

export function resolveMatchSides(
  m: Match,
  tournament: ResolveSidesTournament,
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
      resolveByeWinnerIds(m, tournament) ??
      (m.sideAIds.length > 0
        ? m.sideAIds
        : m.sideBIds.length > 0
          ? m.sideBIds
          : []);
    const winnerLabel =
      winnerIds.length > 0
        ? formatLabel(winnerIds, tournament.players)
        : m.slotA
          ? slotLabel(m.slotA)
          : m.slotB
            ? slotLabel(m.slotB)
            : '?';
    return {
      sideAIds: winnerIds,
      sideBIds: [],
      labelA: winnerLabel,
      labelB: '',
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
      waitingReason: getActiveStrings().knockoutWaitGroup,
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
      waitingReason: getActiveStrings().knockoutWaitPrior,
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

/** 淘汰赛签位规模：仅奇数人数扩至 2 的幂（首轮轮空），偶数不补位 */
export function initialKnockoutBracketSize(entrantCount: number): number {
  if (entrantCount < 2) return 0;
  if (entrantCount % 2 === 1) return nextPowerOfTwo(entrantCount);
  return entrantCount;
}

/** 单档淘汰赛签表场次数（含首轮轮空，网球仅决冠亚军无季军赛） */
export function countBracketMatches(entrantCount: number): number {
  const size = initialKnockoutBracketSize(entrantCount);
  if (size < 2) return 0;
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

/** 首轮对阵：奇数人数时 (选手, null) 为轮空；偶数人数两两对阵，无轮空 */
function buildFirstRoundPairings<T>(
  entrants: readonly T[],
  seedMode: ScheduleSeedMode,
): [T, T | null][] {
  const n = entrants.length;
  const ordered =
    seedMode === 'random' ? shuffle([...entrants]) : [...entrants];

  if (n % 2 === 0) {
    const pairs: [T, T | null][] = [];
    for (let i = 0; i < n; i += 2) {
      pairs.push([ordered[i]!, ordered[i + 1]!]);
    }
    return pairs;
  }

  const size = nextPowerOfTwo(n);
  const byeCount = size - n;
  const matchPlayers = n - byeCount;
  const regularPairs = matchPlayers / 2;
  const pairs: [T, T | null][] = [];
  let i = 0;
  for (let p = 0; p < regularPairs; p++) {
    pairs.push([ordered[i]!, ordered[i + 1]!]);
    i += 2;
  }
  for (; i < n; i++) {
    pairs.push([ordered[i]!, null]);
  }
  return pairs;
}

/** 按本轮剩余人数决定阶段标签 */
function stageForBracketRound(remaining: number): KnockoutStage {
  if (remaining <= 2) return 'final';
  if (remaining <= 4) return 'semi';
  return 'quarter';
}

function createKnockoutAdd(matches: Match[], startOrder: number) {
  let order = startOrder;
  return (
    stage: KnockoutStage,
    rankTier: number,
    round: number,
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
      knockoutRound: round,
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
      sets: [],
      retiredSide: null,
      playedAt: isBye ? new Date().toISOString() : null,
      isBye,
      scheduleMarkedDone: false,
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
  round: number,
  entrant: BracketEntrant,
  stage: KnockoutStage = 'bye',
): Match {
  if (entrant.kind === 'sides') {
    return add(stage, rankTier, round, null, null, entrant.sideIds, [], true);
  }
  if (entrant.kind === 'slot') {
    return add(stage, rankTier, round, entrant.slot, null, [], [], true);
  }
  if (entrant.kind === 'winner' || entrant.kind === 'loser') {
    return add(stage, rankTier, round, entrant, null, [], [], true);
  }
  throw new Error('bye advance requires sides or slot entrant');
}

function addPairMatch(
  add: ReturnType<typeof createKnockoutAdd>,
  rankTier: number,
  round: number,
  stage: KnockoutStage,
  a: BracketEntrant,
  b: BracketEntrant,
): Match {
  return add(
    stage,
    rankTier,
    round,
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
  seedMode: ScheduleSeedMode,
): void {
  if (entrants.length === 2) {
    const stage = entrants[0].kind === 'slot' ? 'cross' : 'final';
    addPairMatch(add, rankTier, 1, stage, entrants[0], entrants[1]);
    return;
  }

  const firstPairs = buildFirstRoundPairings(entrants, seedMode);
  const firstStage = stageForBracketRound(firstPairs.length * 2);
  let current: BracketEntrant[] = [];
  let round = 1;

  for (const [a, b] of firstPairs) {
    if (b === null) {
      const byeM = addByeAdvance(add, rankTier, round, a, 'bye');
      current.push({ kind: 'winner', matchId: byeM.id });
    } else {
      const m = addPairMatch(add, rankTier, round, firstStage, a, b);
      current.push({ kind: 'winner', matchId: m.id });
    }
  }

  while (current.length > 1) {
    round += 1;
    if (current.length === 2) {
      const a = current[0]!;
      const b = current[1]!;
      const semiA =
        a.kind === 'winner' || a.kind === 'loser' ? a : null;
      const semiB =
        b.kind === 'winner' || b.kind === 'loser' ? b : null;
      if (semiA && semiB) {
        add('final', rankTier, round, semiA, semiB);
      } else {
        addPairMatch(add, rankTier, round, 'final', a, b);
      }
      return;
    }

    const next: BracketEntrant[] = [];
    const stage = stageForBracketRound(current.length);

    for (let i = 0; i < current.length; ) {
      if (i === current.length - 1) {
        const byeM = addByeAdvance(add, rankTier, round, current[i]!, stage);
        next.push({ kind: 'winner', matchId: byeM.id });
        break;
      }
      const a = current[i]!;
      const b = current[i + 1]!;
      const m = addPairMatch(add, rankTier, round, stage, a, b);
      next.push({ kind: 'winner', matchId: m.id });
      i += 2;
    }
    current = next;
  }
}

export function buildPureKnockoutSchedule(
  players: Player[],
  teams: Team[],
  mode: MatchMode,
  seedMode: ScheduleSeedMode = 'random',
): { matches: Match[]; nextOrder: number } {
  const entrants =
    mode === 'singles'
      ? orderEntities(players, seedMode).map((p) => ({
          kind: 'sides' as const,
          sideIds: [p.id],
        }))
      : orderEntities(teams, seedMode).map((t) => ({
          kind: 'sides' as const,
          sideIds: [...t.playerIds],
        }));

  const matches: Match[] = [];
  const add = createKnockoutAdd(matches, 1);
  buildEliminationBracket(entrants, 1, add, seedMode);
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
  seedMode: ScheduleSeedMode,
): void {
  const sorted = [...groups].sort((a, b) => a.id - b.id);
  const entrants = sorted.map((g) => ({
    kind: 'slot' as const,
    slot: { kind: 'group_rank' as const, group: g.id, rank },
  }));
  buildEliminationBracket(entrants, rank, add, seedMode);
}

export function buildKnockoutMatches(
  groups: GroupAssignment[],
  startOrder: number,
  seedMode: ScheduleSeedMode = 'random',
): { matches: Match[]; nextOrder: number } {
  const matches: Match[] = [];
  const add = createKnockoutAdd(matches, startOrder);

  const maxRank = maxKnockoutRank(groups);
  for (let r = 1; r <= maxRank; r++) {
    buildKnockoutForRank(r, groups, add, seedMode);
  }

  return { matches, nextOrder: startOrder + matches.length };
}

export function getTournamentChampion(
  tournament: ResolveSidesTournament &
    Pick<Tournament, 'scheduleFormat'>,
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
  const winnerSide = getMatchWinnerSide(
    titleMatch,
    resolveMatchBestOf(titleMatch, tournament),
  );
  if (winnerSide === 'A') return resolved.labelA;
  if (winnerSide === 'B') return resolved.labelB;
  return null;
}
