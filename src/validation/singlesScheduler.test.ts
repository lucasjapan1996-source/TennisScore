import { describe, expect, it } from 'vitest';
import {
  buildSequentialAdjacentSinglesPairs,
  buildSinglesRoundRobinSchedule,
  createSinglesScheduleState,
  evaluateSinglesScheduleQuality,
  scoreSinglesPairingDetailed,
  scheduleSinglesByRounds,
} from '../utils/singlesScheduler';
import { buildCircleRoundRobinRounds, flattenRoundRobinRounds, pairingKey } from '../utils/matchOrder';
import { buildRoundRobinSchedule } from '../utils/schedule';
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

describe('singlesScheduler soft constraints', () => {
  it('sequential: adjacent pairs score higher early', () => {
    const ids = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];
    const state = createSinglesScheduleState(ids);
    const adjacent = buildSequentialAdjacentSinglesPairs(ids)[0]!;
    const distant: readonly [string, string] = [ids[0], ids[3]];
    const adjScore = scoreSinglesPairingDetailed(state, adjacent, {
      sequential: true,
      playerIds: ids,
    }).total;
    const farScore = scoreSinglesPairingDetailed(state, distant, {
      sequential: true,
      playerIds: ids,
    }).total;
    expect(adjScore).toBeGreaterThan(farScore);
  });

  it('8 players sequential: adjacent pairs appear in first wave', () => {
    const ids = Array.from({ length: 8 }, (_, i) => `p${i + 1}`);
    const timeline = buildSinglesRoundRobinSchedule(ids, 'sequential');
    const early = timeline.slice(0, 4).map(([a, b]) => pairingKey(a, b, (x) => x));
    expect(early).toContain('p1|p2');
    expect(early).toContain('p3|p4');
    expect(early).toContain('p5|p6');
    expect(early).toContain('p7|p8');
  });

  it('schedule quality: fairness and rest within soft bounds', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `p${i + 1}`);
    const timeline = buildSinglesRoundRobinSchedule(ids, 'sequential');
    const q = evaluateSinglesScheduleQuality(timeline, ids);
    expect(q.matchCountSpread).toBeLessThanOrEqual(2);
    expect(q.averageRestGap).toBeGreaterThan(1);
    expect(q.backToBackCount).toBeLessThan(timeline.length * 2);
  });

  it('random mode: limits extreme back-to-back', () => {
    const ids = Array.from({ length: 6 }, (_, i) => `p${i + 1}`);
    const timeline = buildSinglesRoundRobinSchedule(ids, 'random');
    const q = evaluateSinglesScheduleQuality(timeline, ids);
    expect(q.matchCountSpread).toBeLessThanOrEqual(2);
    expect(q.backToBackCount).toBeLessThan(timeline.length);
  });

  it('round builder: no player twice in same round', () => {
    const ids = Array.from({ length: 8 }, (_, i) => `p${i + 1}`);
    const candidates = flattenRoundRobinRounds(
      buildCircleRoundRobinRounds(ids),
    );
    const { rounds } = scheduleSinglesByRounds(candidates, ids, 'sequential');
    for (const round of rounds) {
      const seen = new Set<string>();
      for (const [a, b] of round.matches) {
        expect(seen.has(a)).toBe(false);
        expect(seen.has(b)).toBe(false);
        seen.add(a);
        seen.add(b);
      }
    }
  });

  it('integration: UI line format for 8 players sequential', () => {
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
});
