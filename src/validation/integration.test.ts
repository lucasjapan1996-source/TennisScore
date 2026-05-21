/**
 * 模拟数据回归：球员批量添加、三种赛制、赛制 bo、积分榜与颁奖台
 */
import { describe, it, expect } from 'vitest';
import type { Match, Player, Tournament } from '../types';
import {
  buildGroupStageSchedule,
  buildKnockoutOnlySchedule,
  buildRoundRobinSchedule,
  estimateMatchCount,
  validateBeforeSchedule,
  autoPairPlayers,
} from '../utils/schedule';
import {
  syncPlayersByCount,
  isNumberedBulkName,
  MAX_BULK_PLAYER_COUNT,
} from '../utils/bulkPlayers';
import { resolveMatchBestOf, tournamentHasFinal } from '../utils/bestOf';
import { computeStandings } from '../utils/ranking';
import { computePodium } from '../utils/podium';
import { isMatchPlayed } from '../utils/score';
import {
  defaultGenderForCategory,
  normalizePlayersForCategory,
  showPlayerGender,
} from '../utils/tournamentCategory';
import { getMatchWinnerSide } from '../utils/matchOutcome';

function mockPlayers(n: number, prefix = 'p'): Player[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `${prefix}${i + 1}`,
    name: String(i + 1),
    gender: 'male' as const,
    level: 5 as const,
  }));
}

function baseTournament(overrides: Partial<Tournament> = {}): Tournament {
  return {
    id: 't1',
    name: 'Test',
    description: '',
    category: 'men',
    mode: 'singles',
    doublesPairing: 'fixed',
    scheduleFormat: 'round_robin',
    scheduleSeedMode: 'sequential',
    bestOfMode: 'uniform',
    bestOf: 3,
    customBestOfDefault: 3,
    customBestOfFinal: 5,
    groupCount: 2,
    groups: [],
    players: [],
    teams: [],
    matches: [],
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

function withBo1Win(m: Match, winner: 'A' | 'B'): Match {
  return {
    ...m,
    scoreA: winner === 'A' ? 1 : 0,
    scoreB: winner === 'B' ? 1 : 0,
    tiebreakA: 0,
    tiebreakB: 0,
    sets: [],
    retiredSide: null,
    playedAt: new Date().toISOString(),
  };
}

describe('bulk player sync', () => {
  it('creates numbered players 1..N', () => {
    const list = syncPlayersByCount([], 4, 'male', 3, () => 'a1');
    expect(list.map((p) => p.name)).toEqual(['1', '2', '3', '4']);
  });

  it('keeps manual names and fills missing slots', () => {
    const existing: Player[] = [
      { id: 'm', name: '张三', gender: 'male', level: 5 },
      { id: '1', name: '1', gender: 'male', level: 5 },
    ];
    const list = syncPlayersByCount(existing, 3, 'male', 2, () => 'n2');
    expect(list.map((p) => p.name)).toEqual(['张三', '1', '2', '3']);
    expect(list.find((p) => p.name === '1')?.level).toBe(2);
  });

  it('removes numbered players above N when count shrinks', () => {
    const existing = mockPlayers(8);
    const list = syncPlayersByCount(existing, 5, 'male', 3, () => 'x');
    expect(list.map((p) => p.name)).toEqual(['1', '2', '3', '4', '5']);
  });

  it('does not treat non-slot names as numbered', () => {
    expect(isNumberedBulkName('张三')).toBe(false);
    expect(isNumberedBulkName('01')).toBe(false);
    expect(isNumberedBulkName('12')).toBe(true);
  });

  it('caps at MAX_BULK_PLAYER_COUNT', () => {
    const list = syncPlayersByCount([], 999, 'male', 1, () => crypto.randomUUID());
    expect(list).toHaveLength(MAX_BULK_PLAYER_COUNT);
  });
});

describe('schedule formats (simulated)', () => {
  it('round robin: 4 players → 6 matches, estimate matches', () => {
    const players = mockPlayers(4);
    const { matches } = buildRoundRobinSchedule(
      players,
      [],
      'singles',
      'sequential',
    );
    expect(matches.length).toBe(6);
    expect(estimateMatchCount(4, 'round_robin', 2)).toBe(6);
    expect(validateBeforeSchedule('singles', players, [], 'round_robin', 2)).toBeNull();
  });

  it('knockout only: 4 players → 3 matches (semi+final)', () => {
    const players = mockPlayers(4);
    const { matches } = buildKnockoutOnlySchedule(
      players,
      [],
      'singles',
      'sequential',
    );
    expect(matches.every((m) => m.phase === 'knockout')).toBe(true);
    expect(matches.filter((m) => !m.isBye).length).toBeGreaterThanOrEqual(2);
    expect(estimateMatchCount(4, 'knockout', 2)).toBe(3);
  });

  it('group stage: 8 players, 2 groups', () => {
    const players = mockPlayers(8);
    const { matches, groups } = buildGroupStageSchedule(
      players,
      [],
      'singles',
      2,
      'sequential',
    );
    expect(groups).toHaveLength(2);
    const groupMatches = matches.filter((m) => m.phase === 'group');
    expect(groupMatches.length).toBe(12);
    expect(matches.some((m) => m.phase === 'knockout')).toBe(true);
    expect(estimateMatchCount(8, 'group_stage', 2)).toBe(
      groupMatches.length +
        matches.filter((m) => m.phase === 'knockout' && !m.isBye).length,
    );
  });

  it('doubles fixed teams: 4 players → 1 team match', () => {
    const players = mockPlayers(3);
    const teams = autoPairPlayers(players);
    expect(
      validateBeforeSchedule('doubles', players, teams, 'round_robin', 2, 'fixed'),
    ).not.toBeNull();

    const p4 = mockPlayers(4);
    const t4 = autoPairPlayers(p4);
    expect(
      validateBeforeSchedule('doubles', p4, t4, 'round_robin', 2, 'fixed'),
    ).toBeNull();
    const { matches } = buildRoundRobinSchedule(
      p4,
      t4,
      'doubles',
      'sequential',
      'fixed',
    );
    expect(matches.length).toBe(1);
    expect(
      estimateMatchCount(2, 'round_robin', 2, {
        mode: 'doubles',
        playerCount: 4,
        doublesPairing: 'fixed',
      }),
    ).toBe(1);
  });

  it('doubles rotating partners: 4 players → 3 matches', () => {
    const p4 = mockPlayers(4);
    expect(
      validateBeforeSchedule('doubles', p4, [], 'round_robin', 2, 'rotating'),
    ).toBeNull();
    const { matches } = buildRoundRobinSchedule(
      p4,
      [],
      'doubles',
      'sequential',
      'rotating',
    );
    expect(matches.length).toBe(3);
    expect(
      estimateMatchCount(2, 'round_robin', 2, {
        mode: 'doubles',
        playerCount: 4,
        doublesPairing: 'rotating',
      }),
    ).toBe(3);
  });
});

describe('best of / round robin', () => {
  it('round robin always uses uniform bestOf even if stored custom', () => {
    const t = baseTournament({
      scheduleFormat: 'round_robin',
      bestOfMode: 'custom',
      bestOf: 1,
      customBestOfDefault: 3,
      customBestOfFinal: 5,
    });
    const m: Match = {
      id: 'm1',
      phase: 'group',
      group: null,
      order: 1,
      sideAIds: ['a'],
      sideBIds: ['b'],
      scoreA: null,
      scoreB: null,
      tiebreakA: 0,
      tiebreakB: 0,
      sets: [],
      retiredSide: null,
      playedAt: null,
      knockoutStage: null,
      knockoutRank: null,
      slotA: null,
      slotB: null,
      isBye: false,
    };
    expect(resolveMatchBestOf(m, t)).toBe(1);
    expect(tournamentHasFinal('round_robin')).toBe(false);
  });

  it('custom bo: final uses customBestOfFinal', () => {
    const t = baseTournament({
      scheduleFormat: 'knockout',
      bestOfMode: 'custom',
      customBestOfDefault: 3,
      customBestOfFinal: 5,
    });
    const semi: Match = {
      id: 's',
      phase: 'knockout',
      group: null,
      order: 1,
      sideAIds: ['a'],
      sideBIds: ['b'],
      scoreA: null,
      scoreB: null,
      tiebreakA: 0,
      tiebreakB: 0,
      sets: [],
      retiredSide: null,
      playedAt: null,
      knockoutStage: 'semi',
      knockoutRank: 1,
      slotA: null,
      slotB: null,
      isBye: false,
    };
    const final: Match = { ...semi, id: 'f', knockoutStage: 'final' };
    expect(resolveMatchBestOf(semi, t)).toBe(3);
    expect(resolveMatchBestOf(final, t)).toBe(5);
  });
});

describe('standings & podium (simulated scores)', () => {
  it('round robin: top player after all wins', () => {
    const players = mockPlayers(4);
    const { matches } = buildRoundRobinSchedule(
      players,
      [],
      'singles',
      'sequential',
    );
    const p1 = players[0].id;
    const scored = matches.map((m) => {
      const winA = m.sideAIds.includes(p1);
      const winB = m.sideBIds.includes(p1);
      if (!winA && !winB) return withBo1Win(m, 'A');
      if (winA) return withBo1Win(m, 'A');
      if (winB) return withBo1Win(m, 'B');
      return m;
    });
    const t = baseTournament({
      players,
      matches: scored,
      bestOf: 1,
    });
    const standings = computeStandings(
      'singles',
      t.players,
      t.teams,
      t.matches,
      t,
    );
    expect(standings[0]?.id).toBe(p1);
    expect(standings[0]?.wins).toBe(3);
    const podium = computePodium(t);
    expect(podium?.[0]?.ready).toBe(true);
    expect(podium?.[0]?.sideIds).toContain(p1);
  });

  it('doubles fixed round robin: team standings and labels', () => {
    const players = mockPlayers(4);
    const teams = autoPairPlayers(players);
    const { matches } = buildRoundRobinSchedule(
      players,
      teams,
      'doubles',
      'sequential',
      'fixed',
    );
    const teamKey = [...teams[0].playerIds].sort().join(',');
    const scored = matches.map((m) =>
      m.sideAIds.includes(teams[0].playerIds[0]) ||
      m.sideAIds.includes(teams[0].playerIds[1])
        ? withBo1Win(m, 'A')
        : withBo1Win(m, 'B'),
    );
    const t = baseTournament({
      mode: 'doubles',
      doublesPairing: 'fixed',
      players,
      teams,
      matches: scored,
      bestOf: 1,
    });
    const standings = computeStandings(
      'doubles',
      t.players,
      t.teams,
      t.matches,
      t,
    );
    expect(standings[0]?.id).toBe(teamKey);
    expect(standings[0]?.wins).toBe(1);
    expect(standings[0]?.played).toBe(1);
  });

  it('women category hides gender in labels', () => {
    expect(showPlayerGender('women')).toBe(false);
    const normalized = normalizePlayersForCategory(
      [{ id: '1', name: 'A', gender: 'female', level: 5 }],
      'women',
    );
    expect(normalized[0].gender).toBe('female');
    expect(defaultGenderForCategory('women')).toBe('female');
  });

  it('mixed category keeps player gender', () => {
    expect(showPlayerGender('mixed')).toBe(true);
    const p: Player = { id: '1', name: 'A', gender: 'female', level: 5 };
    const normalized = normalizePlayersForCategory([p], 'mixed');
    expect(normalized[0].gender).toBe('female');
  });
});

describe('knockout progression (simulated)', () => {
  it('4-player bracket: winners advance after scoring', () => {
    const players = mockPlayers(4);
    let { matches } = buildKnockoutOnlySchedule(
      players,
      [],
      'singles',
      'sequential',
    );
    const playable = matches.filter((m) => !m.isBye && m.sideAIds.length && m.sideBIds.length);
    const firstRound = playable.filter((m) => m.knockoutRank === 1);
    expect(firstRound.length).toBeGreaterThanOrEqual(1);

    matches = matches.map((m) => {
      const fr = firstRound.find((x) => x.id === m.id);
      if (fr) return withBo1Win(m, 'A');
      return m;
    });

    for (const m of matches) {
      if (!isMatchPlayed(m) || m.isBye) continue;
      const bo = resolveMatchBestOf(m, baseTournament({ scheduleFormat: 'knockout' }));
      expect(getMatchWinnerSide(m, bo)).toBeTruthy();
    }
  });
});
