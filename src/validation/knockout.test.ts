import { describe, expect, it } from 'vitest';
import {
  countBracketMatches,
  initialKnockoutBracketSize,
} from '../utils/knockout';
import { buildKnockoutOnlySchedule } from '../utils/schedule';
import type { Player } from '../types';

function mockPlayers(n: number): Player[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: `${i + 1}`,
    gender: 'male' as const,
    level: 5 as const,
  }));
}

function firstRoundByes(matches: ReturnType<typeof buildKnockoutOnlySchedule>['matches']) {
  return matches.filter((m) => m.isBye && m.knockoutRound === 1);
}

function laterRoundByes(matches: ReturnType<typeof buildKnockoutOnlySchedule>['matches']) {
  return matches.filter((m) => m.isBye && (m.knockoutRound ?? 0) > 1);
}

describe('knockout bracket byes', () => {
  it('bracket size: odd pads to power of two, even stays exact', () => {
    expect(initialKnockoutBracketSize(5)).toBe(8);
    expect(initialKnockoutBracketSize(4)).toBe(4);
    expect(initialKnockoutBracketSize(6)).toBe(6);
    expect(countBracketMatches(5)).toBe(7);
    expect(countBracketMatches(6)).toBe(5);
  });

  it('4 players: no byes', () => {
    const { matches } = buildKnockoutOnlySchedule(
      mockPlayers(4),
      [],
      'singles',
      'sequential',
    );
    expect(matches.filter((m) => m.isBye)).toHaveLength(0);
  });

  it('8 players: no byes', () => {
    const { matches } = buildKnockoutOnlySchedule(
      mockPlayers(8),
      [],
      'singles',
      'sequential',
    );
    expect(matches.filter((m) => m.isBye)).toHaveLength(0);
  });

  it('6 players (even): no first-round bye, one semi bye', () => {
    const { matches } = buildKnockoutOnlySchedule(
      mockPlayers(6),
      [],
      'singles',
      'sequential',
    );
    expect(firstRoundByes(matches)).toHaveLength(0);
    expect(matches.filter((m) => m.isBye)).toHaveLength(1);
    expect(matches.filter((m) => !m.isBye).length).toBe(5);
    expect(matches.filter((m) => m.knockoutRound === 1 && !m.isBye)).toHaveLength(3);
  });

  it('5 players (odd): byes only in first round', () => {
    const { matches } = buildKnockoutOnlySchedule(
      mockPlayers(5),
      [],
      'singles',
      'sequential',
    );
    expect(firstRoundByes(matches).length).toBe(3);
    expect(laterRoundByes(matches)).toHaveLength(0);
  });

  it('3 players (odd): one first-round bye', () => {
    const { matches } = buildKnockoutOnlySchedule(
      mockPlayers(3),
      [],
      'singles',
      'sequential',
    );
    expect(firstRoundByes(matches).length).toBe(1);
    expect(laterRoundByes(matches)).toHaveLength(0);
  });

  it('12 players: 6+3+semi bye+final', () => {
    const { matches } = buildKnockoutOnlySchedule(
      mockPlayers(12),
      [],
      'singles',
      'sequential',
    );
    const playable = matches.filter((m) => !m.isBye);
    const byes = matches.filter((m) => m.isBye);
    expect(playable).toHaveLength(11);
    expect(matches).toHaveLength(12);
    expect(byes).toHaveLength(1);
    expect(byes[0]?.knockoutStage).toBe('semi');
    expect(byes[0]?.knockoutRound).toBe(3);

    const r1 = playable.filter((m) => m.knockoutRound === 1);
    const r2 = playable.filter((m) => m.knockoutRound === 2);
    const semi = playable.filter((m) => m.knockoutRound === 3 && !m.isBye);
    const final = playable.filter((m) => m.knockoutStage === 'final');
    expect(r1).toHaveLength(6);
    expect(r2).toHaveLength(3);
    expect(semi).toHaveLength(1);
    expect(final).toHaveLength(1);
  });
});
