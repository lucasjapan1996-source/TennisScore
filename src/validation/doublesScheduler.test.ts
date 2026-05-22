import { describe, expect, it } from 'vitest';
import {
  buildRotatingDoublesSchedule,
  buildSequentialDoublesWaves,
  createDoublesScheduleState,
  evaluateScheduleQuality,
  scoreDoublesMatchDetailed,
  scheduleDoublesByRounds,
  buildDoublesCandidatePool,
} from '../utils/doublesScheduler';
import { matchupKey } from '../utils/doublesRoundRobin';
import { formatScheduleMatchLine } from '../utils/player';
import { buildRoundRobinSchedule } from '../utils/schedule';
import type { Player } from '../types';

function mockPlayers(n: number): Player[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: `${i + 1}`,
    gender: 'male' as const,
    level: 5 as const,
  }));
}

describe('doublesScheduler soft constraints', () => {
  it('sequential waves: 8 players → 12vs34 then 56vs78', () => {
    const ids = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];
    const waves = buildSequentialDoublesWaves(ids);
    expect(waves).toHaveLength(2);
    expect(matchupKey(waves[0])).toBe('p1,p2|p3,p4');
    expect(matchupKey(waves[1])).toBe('p5,p6|p7,p8');
  });

  it('wave matches score higher early in sequential mode', () => {
    const ids = ['p1', 'p2', 'p3', 'p4', 'p5', 'p6', 'p7', 'p8'];
    const state = createDoublesScheduleState(ids);
    const wave = buildSequentialDoublesWaves(ids)[0]!;
    const other: import('../utils/doublesRoundRobin').DoublesMatchup = {
      sideA: [ids[0], ids[2]],
      sideB: [ids[1], ids[3]],
    };
    const waveScore = scoreDoublesMatchDetailed(state, wave, {
      sequential: true,
      playerIds: ids,
    }).total;
    const otherScore = scoreDoublesMatchDetailed(state, other, {
      sequential: true,
      playerIds: ids,
    }).total;
    expect(waveScore).toBeGreaterThan(otherScore);
  });

  it('10 players sequential: adjacent blocks fixed at start', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `p${i + 1}`);
    const timeline = buildRotatingDoublesSchedule(ids, 'sequential');
    expect(timeline.length).toBeGreaterThan(2);
    expect(matchupKey(timeline[0])).toBe('p1,p2|p3,p4');
    expect(matchupKey(timeline[1])).toBe('p5,p6|p7,p8');
  });

  it('schedule quality: fairness and rotation within soft bounds', () => {
    const ids = Array.from({ length: 10 }, (_, i) => `p${i + 1}`);
    const timeline = buildRotatingDoublesSchedule(ids, 'sequential');
    const q = evaluateScheduleQuality(timeline, ids);
    expect(q.matchCountSpread).toBeLessThanOrEqual(3);
    expect(q.maxTeammateRepeat).toBeLessThanOrEqual(3);
    expect(q.averageRestGap).toBeGreaterThan(1);
    expect(q.backToBackCount).toBeLessThan(timeline.length * 2);
  });

  it('random mode: still limits extreme repeats', () => {
    const ids = Array.from({ length: 8 }, (_, i) => `p${i + 1}`);
    const timeline = buildRotatingDoublesSchedule(ids, 'random');
    const q = evaluateScheduleQuality(timeline, ids);
    expect(q.matchCountSpread).toBeLessThanOrEqual(3);
    expect(q.maxTeammateRepeat).toBeLessThanOrEqual(4);
  });

  it('round builder: no player twice in same round', () => {
    const ids = Array.from({ length: 8 }, (_, i) => `p${i + 1}`);
    const pool = buildDoublesCandidatePool(ids, 40);
    const { rounds } = scheduleDoublesByRounds(pool, ids, 'sequential');
    for (const round of rounds) {
      const seen = new Set<string>();
      for (const m of round.matches) {
        for (const id of [...m.sideA, ...m.sideB]) {
          expect(seen.has(id)).toBe(false);
          seen.add(id);
        }
      }
    }
  });

  it('integration: UI line format for 8 players', () => {
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
    expect(line0).toBe('1/2 vs 3/4');
  });
});
