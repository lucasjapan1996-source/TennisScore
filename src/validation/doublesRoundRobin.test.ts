import { describe, expect, it } from 'vitest';
import type { Player } from '../types';
import {
  allPartnerships,
  buildDoublesPartnerRoundRobinMatches,
  countDoublesPartnerRoundMatches,
  partnershipKey,
  selectPartnerRoundMatches,
} from '../utils/doublesRoundRobin';
import { buildRoundRobinSchedule } from '../utils/schedule';
import { computeStandings } from '../utils/ranking';

function mockPlayers(n: number): Player[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: `${i + 1}`,
    gender: 'male' as const,
    level: 5 as const,
  }));
}

function partnershipCoverage(playerIds: string[], matches: ReturnType<typeof selectPartnerRoundMatches>) {
  const covered = new Set<string>();
  for (const m of matches) {
    covered.add(partnershipKey(m.sideA[0], m.sideA[1]));
    covered.add(partnershipKey(m.sideB[0], m.sideB[1]));
  }
  const required = allPartnerships(playerIds).map(([a, b]) => partnershipKey(a, b));
  return required.every((k) => covered.has(k));
}

describe('doubles partner round robin', () => {
  it('covers every partnership for 4 and 6 players', () => {
    const ids4 = ['a', 'b', 'c', 'd'];
    expect(partnershipCoverage(ids4, selectPartnerRoundMatches(ids4))).toBe(true);
    expect(selectPartnerRoundMatches(ids4).length).toBe(3);

    const ids6 = ['1', '2', '3', '4', '5', '6'];
    expect(partnershipCoverage(ids6, selectPartnerRoundMatches(ids6))).toBe(true);
  });

  it('count and schedule for 4 players doubles', () => {
    expect(countDoublesPartnerRoundMatches(4)).toBe(3);
    const players = mockPlayers(4);
    const { matches } = buildRoundRobinSchedule(
      players,
      [],
      'doubles',
      'sequential',
      'rotating',
    );
    expect(matches).toHaveLength(3);
    expect(matches.every((m) => m.sideAIds.length === 2 && m.sideBIds.length === 2)).toBe(true);
  });

  it('standings use per-player stats', () => {
    const players = mockPlayers(4);
    const { matches } = buildRoundRobinSchedule(
      players,
      [],
      'doubles',
      'sequential',
      'rotating',
    );
    const finished = matches.map((m, i) => ({
      ...m,
      scoreA: i % 2 === 0 ? 6 : 4,
      scoreB: i % 2 === 0 ? 4 : 6,
    }));
    const standings = computeStandings('doubles', players, [], finished, {
      mode: 'doubles',
      doublesPairing: 'rotating',
      scheduleFormat: 'round_robin',
      category: 'men',
      bestOfMode: 'uniform',
      bestOf: 1,
      customBestOfDefault: 1,
      customBestOfFinal: 1,
    });
    expect(standings).toHaveLength(4);
    expect(standings.every((r) => r.played > 0)).toBe(true);
  });

  it('buildDoublesPartnerRoundRobinMatches assigns order', () => {
    const ids = ['p1', 'p2', 'p3', 'p4'];
    const orders: number[] = [];
    buildDoublesPartnerRoundRobinMatches(ids, (order) => {
      orders.push(order);
      return { order } as never;
    });
    expect(orders).toEqual([1, 2, 3]);
  });
});
