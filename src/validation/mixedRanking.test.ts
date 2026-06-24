import { describe, expect, it } from 'vitest';
import type { Match, Player } from '../types';
import { computeStandings } from '../utils/ranking';

function mockPlayers(): Player[] {
  return [
    { id: 'm1', name: '男A', gender: 'male', level: 5 },
    { id: 'f1', name: '女A', gender: 'female', level: 5 },
  ];
}

let matchSeq = 0;

function match(a: string, b: string, scoreA: number, scoreB: number): Match {
  matchSeq += 1;
  return {
    id: `m${matchSeq}`,
    phase: 'group',
    group: null,
    knockoutStage: null,
    knockoutRound: null,
    knockoutRank: null,
    slotA: null,
    slotB: null,
    order: 1,
    sideAIds: [a],
    sideBIds: [b],
    scoreA,
    scoreB,
    tiebreakA: 0,
    tiebreakB: 0,
    sets: [],
    retiredSide: null,
    playedAt: null,
    isBye: false,
    scheduleMarkedDone: false,
    courtWave: null,
  };
}

describe('mixed category standings', () => {
  it('ranks female higher when stats are tied', () => {
    const players = mockPlayers();
    const standings = computeStandings(
      'singles',
      players,
      [],
      [match('m1', 'f1', 4, 6), match('m1', 'f1', 6, 4)],
      {
      mode: 'singles',
      doublesPairing: 'fixed',
      scheduleFormat: 'round_robin',
      category: 'mixed',
      bestOfMode: 'uniform',
      bestOf: 1,
      customBestOfDefault: 1,
      customBestOfFinal: 1,
      },
    );
    expect(standings).toHaveLength(2);
    expect(standings[0].gameDiff).toBe(standings[1].gameDiff);
    expect(standings[0].wins).toBe(standings[1].wins);
    expect(standings[0].id).toBe('f1');
  });
});
