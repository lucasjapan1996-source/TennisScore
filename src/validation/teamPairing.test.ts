import { describe, expect, it } from 'vitest';
import { applyTeamPairChange, autoPairPlayers } from '../utils/schedule';
import type { Player } from '../types';

function mockPlayers(n: number): Player[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: `${i + 1}`,
    gender: 'male' as const,
    level: 5 as const,
  }));
}

describe('applyTeamPairChange', () => {
  it('swaps other team when first team changes (1+2 / 3+4 → 1+3 → 2+4)', () => {
    const players = mockPlayers(4);
    const order = players.map((p) => p.id);
    const teams = autoPairPlayers(players);
    const next = applyTeamPairChange(teams, 0, 'p1', 'p3', order);
    expect(next[0].playerIds).toEqual(['p1', 'p3']);
    expect(next[1].playerIds).toEqual(['p2', 'p4']);
  });

  it('handles reversed display order on second team', () => {
    const players = mockPlayers(4);
    const order = players.map((p) => p.id);
    const teams = autoPairPlayers(players);
    teams[1].playerIds = ['p4', 'p3'];
    const next = applyTeamPairChange(teams, 0, 'p1', 'p3', order);
    expect(next[0].playerIds).toEqual(['p1', 'p3']);
    expect(next[1].playerIds).toEqual(['p2', 'p4']);
  });
});
