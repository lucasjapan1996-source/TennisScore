import { describe, expect, it } from 'vitest';
import {
  buildRoundRobinSchedule,
  isFixedDoublesPairingAllowed,
  normalizeDoublesPairingForPlayers,
  validateBeforeSchedule,
} from '../utils/schedule';
import type { Player } from '../types';

function mockPlayers(n: number): Player[] {
  return Array.from({ length: n }, (_, i) => ({
    id: `p${i + 1}`,
    name: `${i + 1}`,
    gender: 'male' as const,
    level: 5 as const,
  }));
}

describe('odd doubles rotating', () => {
  it('fixed pairing disallowed for odd count', () => {
    expect(isFixedDoublesPairingAllowed(5)).toBe(false);
    expect(normalizeDoublesPairingForPlayers('doubles', 'fixed', 5)).toBe(
      'rotating',
    );
  });

  it('5 players rotating round robin validates and generates matches', () => {
    const players = mockPlayers(5);
    const err = validateBeforeSchedule(
      'doubles',
      players,
      [],
      'round_robin',
      2,
      'rotating',
    );
    expect(err).toBeNull();
    const { matches } = buildRoundRobinSchedule(
      players,
      [],
      'doubles',
      'sequential',
      'rotating',
    );
    expect(matches).toHaveLength(5);
  });

  it('fixed pairing rejected when odd', () => {
    const players = mockPlayers(5);
    const err = validateBeforeSchedule(
      'doubles',
      players,
      [],
      'round_robin',
      2,
      'fixed',
    );
    expect(err).not.toBeNull();
  });
});
