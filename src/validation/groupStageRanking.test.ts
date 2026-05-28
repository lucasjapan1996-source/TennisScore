import { describe, expect, it } from 'vitest';
import type { Match, Player } from '../types';
import { buildGroupStageSchedule } from '../utils/schedule';
import { computeGroupStageFinalStandings } from '../utils/ranking';

const tournamentFields = {
  mode: 'singles' as const,
  doublesPairing: 'fixed' as const,
  scheduleFormat: 'group_stage' as const,
  category: 'men' as const,
  bestOfMode: 'uniform' as const,
  bestOf: 1 as const,
  customBestOfDefault: 1 as const,
  customBestOfFinal: 1 as const,
};

function players8(): Player[] {
  return Array.from({ length: 8 }, (_, i) => ({
    id: `p${i + 1}`,
    name: `P${i + 1}`,
    gender: 'male' as const,
    level: 5 as const,
  }));
}

function setWinner(m: Match, winnerId: string): Match {
  const onA = m.sideAIds[0] === winnerId;
  return {
    ...m,
    scoreA: onA ? 6 : 3,
    scoreB: onA ? 3 : 6,
    sets: [],
  };
}

function playAllGroupMatches(matches: Match[], groups: { id: number; memberIds: string[] }[]) {
  let next = matches.map((m) => ({ ...m, sets: [...m.sets] }));
  for (const g of groups) {
    const gm = next.filter((m) => m.phase === 'group' && m.group === g.id);
    for (const m of gm) {
      const winner = g.memberIds[0]!;
      next = next.map((x) => (x.id === m.id ? setWinner(x, winner) : x));
    }
  }
  return next;
}

function playKnockoutFinal(
  matches: Match[],
  tier: number,
  winnerId: string,
  loserId: string,
): Match[] {
  const final = matches.find(
    (m) =>
      m.phase === 'knockout' &&
      m.knockoutRank === tier &&
      (m.knockoutStage === 'final' || m.knockoutStage === 'cross'),
  );
  expect(final).toBeTruthy();
  return matches.map((m) => {
    if (m.id !== final!.id) return m;
    return {
      ...m,
      sideAIds: [winnerId],
      sideBIds: [loserId],
      scoreA: 6,
      scoreB: 2,
      sets: [],
    };
  });
}

describe('group stage final standings', () => {
  it('two groups: A1 vs B1 → 1st/2nd, A2 vs B2 → 3rd/4th', () => {
    const players = players8().slice(0, 4);
    const { matches: initial, groups } = buildGroupStageSchedule(
      players,
      [],
      'singles',
      2,
      'sequential',
    );

    let matches = playAllGroupMatches(initial, groups);
    const a1 = groups[0]!.memberIds[0]!;
    const b1 = groups[1]!.memberIds[0]!;
    const a2 = groups[0]!.memberIds[1]!;
    const b2 = groups[1]!.memberIds[1]!;

    matches = playKnockoutFinal(matches, 1, a1, b1);
    matches = playKnockoutFinal(matches, 2, a2, b2);

    const final = computeGroupStageFinalStandings(
      'singles',
      players,
      [],
      groups,
      matches,
      tournamentFields,
    );

    expect(final.find((r) => r.rank === 1)?.id).toBe(a1);
    expect(final.find((r) => r.rank === 2)?.id).toBe(b1);
    expect(final.find((r) => r.rank === 3)?.id).toBe(a2);
    expect(final.find((r) => r.rank === 4)?.id).toBe(b2);
  });

  it('ranks tier-1 champion first with dense display ranks (2 groups)', () => {
    const players = players8().slice(0, 4);
    const { matches: initial, groups } = buildGroupStageSchedule(
      players,
      [],
      'singles',
      2,
      'sequential',
    );

    let matches = playAllGroupMatches(initial, groups);
    const groupWinners = groups.map((g) => g.memberIds[0]!);

    matches = playKnockoutFinal(
      matches,
      1,
      groupWinners[0]!,
      groupWinners[1]!,
    );

    const final = computeGroupStageFinalStandings(
      'singles',
      players,
      [],
      groups,
      matches,
      tournamentFields,
    );

    expect(final[0]?.id).toBe(groupWinners[0]);
    expect(final.map((r) => r.rank)).toEqual([1, 2, 3, 4]);
    expect(final.find((r) => r.id === groupWinners[1])?.rank).toBe(2);
  });

  it('uses tier-2 bracket for ranks 3-4 when two groups of four', () => {
    const players = players8();
    const { matches: initial, groups } = buildGroupStageSchedule(
      players,
      [],
      'singles',
      2,
      'sequential',
    );

    let matches = playAllGroupMatches(initial, groups);
    const winners = groups.map((g) => g.memberIds[0]!);
    const runners = groups.map((g) => g.memberIds[1]!);

    matches = playKnockoutFinal(matches, 1, winners[0]!, winners[1]!);
    matches = playKnockoutFinal(matches, 2, runners[1]!, runners[0]!);

    const final = computeGroupStageFinalStandings(
      'singles',
      players,
      [],
      groups,
      matches,
      tournamentFields,
    );

    expect(final[0]?.id).toBe(winners[0]);
    expect(final[1]?.id).toBe(winners[1]);
    expect(final[2]?.id).toBe(runners[1]);
    expect(final[3]?.id).toBe(runners[0]);
    expect(final.map((r) => r.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
});
