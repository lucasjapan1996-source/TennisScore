import { describe, expect, it } from 'vitest';
import {
  analyzeMatchOrder,
  buildCircleRoundRobinRounds,
  flattenRoundRobinRounds,
  interleaveRoundRobinRounds,
  orderByRestAndFairness,
} from '../utils/matchOrder';
import {
  autoPairPlayers,
  buildGroupStageSchedule,
  buildRoundRobinSchedule,
} from '../utils/schedule';
import { formatScheduleMatchLine } from '../utils/player';
import type { Player } from '../types';

function mockPlayers(n: number): Player[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: `${i + 1}`,
    gender: 'male' as const,
    level: 5 as const,
  }));
}

function matchParticipants(
  sideAIds: string[],
  sideBIds: string[],
): { participants: string[] } {
  return { participants: [...sideAIds, ...sideBIds] };
}

describe('circle round robin ordering', () => {
  it('4 players: full round robin, equal matches', () => {
    const ids = ['a', 'b', 'c', 'd'];
    const rounds = buildCircleRoundRobinRounds(ids);
    const ordered = flattenRoundRobinRounds(rounds);
    expect(ordered).toHaveLength(6);
    expect(rounds).toHaveLength(3);
    expect(rounds.every((r) => r.length === 2)).toBe(true);

    const stats = analyzeMatchOrder(
      ordered.map(([a, b]) => matchParticipants([a], [b])),
    );
    for (const id of ids) {
      expect(stats.playCount.get(id)).toBe(3);
    }
  });

  it('5 players (odd): each plays 4 times', () => {
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const ordered = flattenRoundRobinRounds(buildCircleRoundRobinRounds(ids));
    expect(ordered).toHaveLength(10);
    const stats = analyzeMatchOrder(
      ordered.map(([a, b]) => matchParticipants([a], [b])),
    );
    for (const id of ids) {
      expect(stats.playCount.get(id)).toBe(4);
    }
  });

  it('interleaves two groups by round', () => {
    const g1 = buildCircleRoundRobinRounds(['a', 'b']);
    const g2 = buildCircleRoundRobinRounds(['c', 'd']);
    const merged = interleaveRoundRobinRounds([g1, g2]);
    expect(merged).toEqual([
      ['a', 'b'],
      ['c', 'd'],
    ]);
  });
});

describe('sequential seed block order', () => {
  it('8 players doubles fixed: 12vs34 then 56vs78', () => {
    const players = mockPlayers(8);
    const teams = autoPairPlayers(players);
    const { matches } = buildRoundRobinSchedule(
      players,
      teams,
      'doubles',
      'sequential',
      'fixed',
    );
    expect(matches.length).toBe(6);
    const line0 = formatScheduleMatchLine(
      matches[0].sideAIds,
      matches[0].sideBIds,
      players,
      'doubles',
    );
    const line1 = formatScheduleMatchLine(
      matches[1].sideAIds,
      matches[1].sideBIds,
      players,
      'doubles',
    );
    expect(line0).toBe('1&2 vs 3&4');
    expect(line1).toBe('5&6 vs 7&8');
  });

  it('8 players singles sequential: adjacent pairs first wave', () => {
    const players = mockPlayers(8);
    const { matches } = buildRoundRobinSchedule(
      players,
      [],
      'singles',
      'sequential',
    );
    const firstFour = matches.slice(0, 4).map((m) =>
      formatScheduleMatchLine(m.sideAIds, m.sideBIds, players, 'singles'),
    );
    expect(firstFour).toEqual(['1 vs 2', '3 vs 4', '5 vs 6', '7 vs 8']);
  });

  it('8 players doubles rotating: 12vs34 then 56vs78', () => {
    const players = mockPlayers(8);
    const { matches } = buildRoundRobinSchedule(
      players,
      [],
      'doubles',
      'sequential',
      'rotating',
    );
    const line0 = formatScheduleMatchLine(
      matches[0].sideAIds,
      matches[0].sideBIds,
      players,
      'doubles',
    );
    const line1 = formatScheduleMatchLine(
      matches[1].sideAIds,
      matches[1].sideBIds,
      players,
      'doubles',
    );
    expect(line0).toBe('1&2 vs 3&4');
    expect(line1).toBe('5&6 vs 7&8');
  });
});

describe('schedule integration', () => {
  it('singles round robin avoids back-to-back', () => {
    const players = mockPlayers(6);
    const { matches } = buildRoundRobinSchedule(
      players,
      [],
      'singles',
      'random',
    );
    const stats = analyzeMatchOrder(
      matches.map((m) => matchParticipants(m.sideAIds, m.sideBIds)),
    );
    expect(stats.hasBackToBack).toBe(false);
    for (const p of players) {
      expect(stats.playCount.get(p.id)).toBe(5);
    }
  });

  it('group stage random seed interleaves groups by round', () => {
    const players = mockPlayers(8);
    const { matches } = buildGroupStageSchedule(
      players,
      [],
      'singles',
      2,
      'random',
    );
    const groupMatches = matches.filter((m) => m.phase === 'group');
    const stats = analyzeMatchOrder(
      groupMatches.map((m) => matchParticipants(m.sideAIds, m.sideBIds)),
    );
    expect(stats.hasBackToBack).toBe(false);
    for (const p of players) {
      expect(stats.playCount.get(p.id)).toBe(3);
    }
    const firstSix = groupMatches.slice(0, 6).map((m) => m.sideAIds[0]);
    const groupsSeen = new Set(
      firstSix.map((id) => (players.findIndex((p) => p.id === id) < 4 ? 1 : 2)),
    );
    expect(groupsSeen.size).toBe(2);
  });

  it('rotating doubles: equal play count and rest-aware order', () => {
    const items = [
      { sideA: ['a', 'b'] as const, sideB: ['c', 'd'] as const },
      { sideA: ['a', 'c'] as const, sideB: ['b', 'd'] as const },
      { sideA: ['a', 'd'] as const, sideB: ['b', 'c'] as const },
    ];
    const ordered = orderByRestAndFairness(items, (m) => [
      ...m.sideA,
      ...m.sideB,
    ]);
    const stats = analyzeMatchOrder(
      ordered.map((m) => matchParticipants([...m.sideA], [...m.sideB])),
    );
    for (const id of ['a', 'b', 'c', 'd']) {
      expect(stats.playCount.get(id)).toBe(3);
      const gaps = stats.restGaps.get(id) ?? [];
      expect(gaps.length).toBe(2);
    }
  });
});
