/**
 * 2025 法网男单关键赛果回归测试（简化签表：4 强 → 决赛）
 * 数据来源：2025 Roland Garros 半决赛 / 决赛公开比分
 */
import { describe, it, expect, beforeAll } from 'vitest';
import type { Match, Player, Tournament } from '../types';
import { buildKnockoutOnlySchedule } from '../utils/schedule';
import { resolveMatchSides, getTournamentChampion } from '../utils/knockout';
import { formatSideCompactLabel } from '../utils/player';
import {
  applyRetirementScores,
  getMatchWinnerSide,
  matchHasRecordedScore,
  sanitizeRetiredMatch,
  winnerIdsForSide,
} from '../utils/matchOutcome';
import { computePodium, isPodiumComplete } from '../utils/podium';
import { computeGroupAndKnockoutStandings } from '../utils/ranking';
import { formatMatchScore, formatMatchResultsScore, isMatchPlayed } from '../utils/score';
import { resolveMatchBestOf } from '../utils/bestOf';
import { applySetsToMatchScores } from '../utils/score';
import type { SetScore } from '../types';

const PLAYERS: Player[] = [
  { id: 'sinner', name: 'Jannik Sinner', gender: 'male', level: 9 },
  { id: 'djokovic', name: 'Novak Djokovic', gender: 'male', level: 9 },
  { id: 'alcaraz', name: 'Carlos Alcaraz', gender: 'male', level: 9 },
  { id: 'musetti', name: 'Lorenzo Musetti', gender: 'male', level: 7 },
];

function baseTournament(matches: Match[], players: Player[] = PLAYERS): Tournament {
  return {
    id: 'rg2025',
    name: '2025 Roland Garros (test)',
    description: '',
    category: 'men',
    mode: 'singles',
    doublesPairing: 'fixed',
    scheduleFormat: 'knockout',
    scheduleSeedMode: 'sequential',
    courtCount: 1,
    bestOfMode: 'uniform',
    bestOf: 3,
    customBestOfDefault: 3,
    customBestOfFinal: 5,
    groupCount: 2,
    groups: [],
    players,
    teams: [],
    matches,
    scheduleBatchSizes: matches.length > 0 ? [matches.length] : [],
    createdAt: new Date().toISOString(),
  };
}

function withScore(m: Match, scoreA: number, scoreB: number): Match {
  return {
    ...m,
    scoreA,
    scoreB,
    tiebreakA: 0,
    tiebreakB: 0,
    sets: [],
    retiredSide: null,
    playedAt: new Date().toISOString(),
  };
}

function withSets(m: Match, sets: SetScore[], bestOf: 3 | 5): Match {
  const applied = applySetsToMatchScores(sets, bestOf);
  return { ...m, ...applied, retiredSide: null };
}

function withRetirement(
  m: Match,
  retiredSide: 'A' | 'B',
  bestOf: 3 | 5,
  partial?: Pick<Match, 'scoreA' | 'scoreB' | 'sets'>,
): Match {
  const base = partial ? { ...m, ...partial } : m;
  const applied = applyRetirementScores(retiredSide, base, bestOf);
  return sanitizeRetiredMatch({ ...base, ...applied }, bestOf);
}

function knockouts(matches: Match[]): Match[] {
  return [...matches]
    .filter((m) => m.phase === 'knockout' && !m.isBye)
    .sort((a, b) => a.order - b.order);
}

describe('2025 French Open — logic regression', () => {
  let tournament: Tournament;
  let qf1Id: string;
  let qf2Id: string;
  let finalId: string;

  beforeAll(() => {
    const { matches } = buildKnockoutOnlySchedule(
      PLAYERS,
      [],
      'singles',
      'sequential',
    );
    const ko = knockouts(matches);
    expect(ko.length).toBe(3);
    const qf1 = ko[0]!;
    const qf2 = ko[1]!;
    const finalMatch = ko[2]!;
    qf1Id = qf1.id;
    qf2Id = qf2.id;
    finalId = finalMatch.id;

    // 签位顺序：Sinner vs Djokovic，Alcaraz vs Musetti
    expect(qf1.sideAIds).toEqual(['sinner']);
    expect(qf1.sideBIds).toEqual(['djokovic']);
    expect(qf2.sideAIds).toEqual(['alcaraz']);
    expect(qf2.sideBIds).toEqual(['musetti']);

    let m0 = withScore(qf1, 2, 0);
    // 实网前两盘 1-1 后退赛；测试用已决出的 2-0 盘分再标记 Musetti 退赛
    let m1 = withSets(
      qf2,
      [
        { gamesA: 6, gamesB: 4, tiebreakA: 0, tiebreakB: 0 },
        { gamesA: 7, gamesB: 6, tiebreakA: 0, tiebreakB: 3 },
      ],
      3,
    );
    m1 = withRetirement(m1, 'B', 3, {
      scoreA: m1.scoreA,
      scoreB: m1.scoreB,
      sets: m1.sets,
    });

    const updated = matches.map((m) => {
      if (m.id === m0.id) return m0;
      if (m.id === m1.id) return m1;
      return m;
    });

    tournament = baseTournament(updated);
    tournament = {
      ...tournament,
      bestOfMode: 'custom',
      customBestOfFinal: 5,
    };

    const resolvedFinal = resolveMatchSides(
      tournament.matches.find((x) => x.id === finalId)!,
      tournament,
      (ids, players) => formatSideCompactLabel(ids, players, false),
    );
    expect(resolvedFinal.ready).toBe(true);
    const finalistIds = new Set([
      ...resolvedFinal.sideAIds,
      ...resolvedFinal.sideBIds,
    ]);
    expect(finalistIds.has('alcaraz')).toBe(true);
    expect(finalistIds.has('sinner')).toBe(true);

    const alcarazOnSideA = resolvedFinal.sideAIds.includes('alcaraz');
    const finalScored = withScore(
      {
        ...tournament.matches.find((x) => x.id === finalId)!,
        sideAIds: resolvedFinal.sideAIds,
        sideBIds: resolvedFinal.sideBIds,
      },
      alcarazOnSideA ? 3 : 2,
      alcarazOnSideA ? 2 : 3,
    );
    tournament = baseTournament(
      tournament.matches.map((m) => (m.id === finalId ? finalScored : m)),
    );
    tournament.bestOfMode = 'custom';
    tournament.customBestOfFinal = 5;
  });

  it('半决赛：Sinner 2-0 晋级', () => {
    const m = tournament.matches.find((x) => x.id === qf1Id)!;
    expect(getMatchWinnerSide(m, 3)).toBe('A');
    expect(winnerIdsForSide(m, 'A')).toEqual(['sinner']);
    expect(m.scoreA).toBe(2);
    expect(m.scoreB).toBe(0);
  });

  it('半决赛：Musetti 退赛，Alcaraz 晋级且保留已录局分', () => {
    const m = tournament.matches.find((x) => x.id === qf2Id)!;
    expect(m.retiredSide).toBe('B');
    expect(matchHasRecordedScore(m, 3)).toBe(true);
    expect(m.sets?.length).toBeGreaterThanOrEqual(2);
    expect(getMatchWinnerSide(m, 3)).toBe('A');
    expect(m.scoreA).toBe(2);
    expect(m.scoreB).toBe(0);
    expect(formatMatchScore(m)).toContain('2:0');
  });

  it('决赛：Alcaraz 3-2 击败 Sinner（BO5）', () => {
    const m = tournament.matches.find((x) => x.id === finalId)!;
    expect(resolveMatchBestOf(m, tournament)).toBe(5);
    const winner = getMatchWinnerSide(m, 5);
    expect(winner).not.toBeNull();
    expect(winnerIdsForSide(m, winner!)).toEqual(['alcaraz']);
    expect(m.scoreA! + m.scoreB!).toBe(5);
    expect(Math.max(m.scoreA!, m.scoreB!)).toBe(3);
    expect(isMatchPlayed(m)).toBe(true);
  });

  it('颁奖台：冠军 Alcaraz、亚军 Sinner', () => {
    const podium = computePodium(tournament);
    expect(podium).not.toBeNull();
    expect(isPodiumComplete(podium!)).toBe(true);
    expect(podium![0]!.sideIds).toEqual(['alcaraz']);
    expect(podium![1]!.sideIds).toEqual(['sinner']);
  });

  it('冠军名称解析', () => {
    const champ = getTournamentChampion(
      tournament,
      (ids, players) => formatSideCompactLabel(ids, players, false),
    );
    expect(champ).toContain('Alcaraz');
  });

  it('退赛无比分：不写入 2:0，胜者仍可判定', () => {
    const { matches } = buildKnockoutOnlySchedule(
      [
        { id: 'a', name: 'A', gender: 'male', level: 5 },
        { id: 'b', name: 'B', gender: 'male', level: 5 },
      ],
      [],
      'singles',
      'sequential',
    );
    const m = knockouts(matches)[0]!;
    const retired = withRetirement(m, 'B', 3);
    expect(retired.scoreA).toBeNull();
    expect(retired.scoreB).toBeNull();
    expect(retired.sets).toEqual([]);
    expect(getMatchWinnerSide(retired, 3)).toBe('A');
    expect(isMatchPlayed(retired)).toBe(true);
    expect(formatMatchScore(retired)).toBe('退赛');
    expect(formatMatchResultsScore(retired)).toBe('0 : 0');
  });

  it('退赛已录比分但退赛方领先：仍判对方胜，排名页显示原比分', () => {
    const { matches } = buildKnockoutOnlySchedule(
      [
        { id: 'a', name: 'A', gender: 'male', level: 5 },
        { id: 'b', name: 'B', gender: 'male', level: 5 },
      ],
      [],
      'singles',
      'sequential',
    );
    const m = knockouts(matches)[0]!;
    const base = withScore(m, 2, 3);
    const applied = applyRetirementScores('B', base, 1);
    const retired = sanitizeRetiredMatch({ ...base, ...applied }, 1);
    expect(retired.scoreA).toBe(2);
    expect(retired.scoreB).toBe(3);
    expect(getMatchWinnerSide(retired, 1)).toBe('A');
    expect(formatMatchResultsScore(retired)).toBe('2 : 3');
  });

  it('退赛无比分：排名只计胜场不计净胜局', () => {
    const miniPlayers: Player[] = [
      { id: 'p1', name: 'P1', gender: 'male', level: 5 },
      { id: 'p2', name: 'P2', gender: 'male', level: 5 },
    ];
    const { matches } = buildKnockoutOnlySchedule(
      miniPlayers,
      [],
      'singles',
      'sequential',
    );
    const ko = knockouts(matches);
    const m1 = withRetirement(ko[0]!, 'B', 3);
    expect(m1.retiredSide).toBe('B');
    expect(getMatchWinnerSide(m1, 3)).toBe('A');
    const t1 = baseTournament(
      matches.map((x) => (x.id === m1.id ? m1 : x)),
      miniPlayers,
    );
    expect(t1.matches[0]!.retiredSide).toBe('B');
    const standings = computeGroupAndKnockoutStandings(
      'singles',
      t1.players,
      [],
      t1.matches,
      t1,
    );
    const p1 = standings.find((r) => r.id === 'p1');
    expect(p1).toBeDefined();
    expect(p1!.wins).toBe(1);
    expect(p1!.gameDiff).toBe(0);
  });
});
