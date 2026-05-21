import type { BestOf, SetScore } from '../types';
import { isValidMatchScore, setsToWin } from './score';

export function isCompleteSetScore(s: SetScore): boolean {
  return (
    s.gamesA >= 0 &&
    s.gamesB >= 0 &&
    s.gamesA !== s.gamesB &&
    s.tiebreakA >= 0 &&
    s.tiebreakB >= 0
  );
}

export function countSetWins(sets: SetScore[]): { winsA: number; winsB: number } {
  let winsA = 0;
  let winsB = 0;
  for (const s of sets) {
    if (!isCompleteSetScore(s)) continue;
    if (s.gamesA > s.gamesB) winsA++;
    else winsB++;
  }
  return { winsA, winsB };
}

export function isMatchDecided(sets: SetScore[], bestOf: BestOf): boolean {
  const { winsA, winsB } = countSetWins(sets);
  return isValidMatchScore(winsA, winsB, bestOf);
}

/** 可继续录入的下一局序号（1 起），已满则返回 null */
export function nextSetNumber(sets: SetScore[], bestOf: BestOf): number | null {
  if (isMatchDecided(sets, bestOf)) return null;
  const complete = sets.filter(isCompleteSetScore).length;
  if (complete >= bestOf) return null;
  return complete + 1;
}

export function normalizeSetScores(raw: unknown): SetScore[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((item) => {
      const s = item as Partial<SetScore>;
      const gamesA = typeof s.gamesA === 'number' ? s.gamesA : -1;
      const gamesB = typeof s.gamesB === 'number' ? s.gamesB : -1;
      const tiebreakA = typeof s.tiebreakA === 'number' ? s.tiebreakA : 0;
      const tiebreakB = typeof s.tiebreakB === 'number' ? s.tiebreakB : 0;
      return { gamesA, gamesB, tiebreakA, tiebreakB };
    })
    .filter(isCompleteSetScore);
}

export { setsToWin };
