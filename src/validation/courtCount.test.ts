import { describe, expect, it } from 'vitest';
import {
  buildRoundRobinSchedule,
  buildScheduleFromSettings,
  countConsecutiveCourtWaveAppearances,
  effectiveCourtCount,
  groupMatchesIntoCourtWaves,
  maxMeaningfulCourtCount,
  reorderMatchesByCourtCount,
} from '../utils/schedule';
import { analyzeMatchOrder } from '../utils/matchOrder';
import { evaluateScheduleQuality } from '../utils/doublesScheduler';
import type { Player } from '../types';

function mockPlayers(n: number): Player[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: `${i + 1}`,
    gender: 'male' as const,
    level: 5 as const,
  }));
}

function matchParticipants(m: { sideAIds: string[]; sideBIds: string[] }): string[] {
  return [...m.sideAIds, ...m.sideBIds];
}

describe('court count limits', () => {
  it('doubles: 5 players max 1 court, 8+ allows 2', () => {
    expect(maxMeaningfulCourtCount('doubles', 5)).toBe(1);
    expect(maxMeaningfulCourtCount('doubles', 7)).toBe(1);
    expect(maxMeaningfulCourtCount('doubles', 8)).toBe(2);
    expect(effectiveCourtCount(3, 'doubles', 5)).toBe(1);
    expect(effectiveCourtCount(2, 'doubles', 8)).toBe(2);
  });

  it('singles: parallel courts by half player count', () => {
    expect(maxMeaningfulCourtCount('singles', 6)).toBe(3);
    expect(effectiveCourtCount(5, 'singles', 6)).toBe(3);
  });
});

function countBackToBackSlots(
  ordered: readonly { participants: readonly string[] }[],
): number {
  const stats = analyzeMatchOrder(ordered);
  let backToBack = 0;
  for (const gaps of stats.restGaps.values()) {
    backToBack += gaps.filter((g) => g <= 1).length;
  }
  return backToBack;
}

describe('sequential rest ordering (soft)', () => {
  it('5 players doubles sequential: first wave pinned, soft rest scoring', () => {
    const players = mockPlayers(5);
    const ids = players.map((p) => p.id);

    const { matches } = buildScheduleFromSettings(
      players,
      [],
      'doubles',
      'round_robin',
      2,
      'sequential',
      'rotating',
      1,
    );
    expect(matches).toHaveLength(5);
    expect(matches[0]?.sideAIds).toEqual(['p1', 'p2']);
    expect(matches[0]?.sideBIds).toEqual(['p3', 'p4']);

    const stats = analyzeMatchOrder(
      matches.map((m) => ({ participants: matchParticipants(m) })),
    );
    for (const id of ids) {
      expect(stats.playCount.get(id)).toBe(4);
    }

    const timeline = matches.map((m) => ({
      sideA: m.sideAIds as [string, string],
      sideB: m.sideBIds as [string, string],
    }));
    const q = evaluateScheduleQuality(timeline, ids);
    expect(q.matchCountSpread).toBe(0);
    expect(q.backToBackCount).toBeLessThan(timeline.length * 4);
  });

  it('6 players singles sequential with 1 court: soft rest', () => {
    const players = mockPlayers(6);
    const { matches } = buildScheduleFromSettings(
      players,
      [],
      'singles',
      'round_robin',
      2,
      'sequential',
      'fixed',
      1,
    );
    const backToBack = countBackToBackSlots(
      matches.map((m) => ({ participants: matchParticipants(m) })),
    );
    expect(backToBack).toBeLessThan(matches.length);
  });
});

describe('court count grouping', () => {
  it('6 players singles with 2 courts: valid waves, soft rest', () => {
    const players = mockPlayers(6);
    const { matches } = buildRoundRobinSchedule(
      players,
      [],
      'singles',
      'sequential',
    );
    const reordered = reorderMatchesByCourtCount(matches, 2, 0, {
      mode: 'singles',
      playerCount: 6,
    });
    const waves = groupMatchesIntoCourtWaves(reordered, 2);

    expect(waves.length).toBeGreaterThan(1);
    expect(waves.every((wave) => wave.length <= 2)).toBe(true);
    expect(countConsecutiveCourtWaveAppearances(waves)).toBeLessThan(20);
  });

  it('5 players doubles: effective 1 court even if 2 requested', () => {
    const players = mockPlayers(5);
    const { matches } = buildRoundRobinSchedule(
      players,
      [],
      'doubles',
      'sequential',
      'rotating',
    );
    const reordered = reorderMatchesByCourtCount(matches, 2, 0, {
      mode: 'doubles',
      playerCount: 5,
    });
    expect(reordered.every((m) => m.courtWave == null)).toBe(true);
    expect(groupMatchesIntoCourtWaves(reordered, 1)).toHaveLength(1);
  });

  it('8 players doubles: 2 courts allowed', () => {
    const players = mockPlayers(8);
    const { matches } = buildRoundRobinSchedule(
      players,
      [],
      'doubles',
      'sequential',
      'rotating',
    );
    const reordered = reorderMatchesByCourtCount(matches, 2, 0, {
      mode: 'doubles',
      playerCount: 8,
    });
    const waves = groupMatchesIntoCourtWaves(reordered, 2);
    expect(waves.some((wave) => wave.length >= 1)).toBe(true);
    for (const wave of waves) {
      expect(wave.length).toBeLessThanOrEqual(2);
      const seen = new Set<string>();
      for (const m of wave) {
        for (const id of matchParticipants(m)) {
          expect(seen.has(id)).toBe(false);
          seen.add(id);
        }
      }
    }
  });

  it('preserves all matches when reordering', () => {
    const players = mockPlayers(6);
    const { matches } = buildRoundRobinSchedule(
      players,
      [],
      'singles',
      'random',
    );
    const reordered = reorderMatchesByCourtCount(matches, 3, 0, {
      mode: 'singles',
      playerCount: 6,
    });
    expect(reordered).toHaveLength(matches.length);
    expect(new Set(reordered.map((m) => m.id)).size).toBe(matches.length);
    const stats = analyzeMatchOrder(
      reordered.map((m) => ({ participants: matchParticipants(m) })),
    );
    for (const p of players) {
      expect(stats.playCount.get(p.id)).toBe(5);
    }
  });
});
