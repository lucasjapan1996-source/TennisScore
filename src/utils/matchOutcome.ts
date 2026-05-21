import type { BestOf, Match } from '../types';
import { isCompleteSetScore, isMatchDecided, countSetWins } from './sets';

export type RetiredSide = 'A' | 'B';

export function isRetired(m: Pick<Match, 'retiredSide'>): boolean {
  return m.retiredSide === 'A' || m.retiredSide === 'B';
}

/** 退赛方 retiredSide，另一方获胜 */
export function winnerSideFromRetirement(retiredSide: RetiredSide): 'A' | 'B' {
  return retiredSide === 'A' ? 'B' : 'A';
}

/** 是否已有用户录入的有效比分（不含退赛自动写入的 2:0 等） */
export function matchHasRecordedScore(
  m: Pick<Match, 'scoreA' | 'scoreB' | 'tiebreakA' | 'tiebreakB' | 'sets'>,
  bestOf: BestOf = 1,
): boolean {
  const completed = (m.sets ?? []).filter(isCompleteSetScore);
  if (completed.length > 0) return true;

  if (m.scoreA === null || m.scoreB === null) return false;
  if (m.scoreA === m.scoreB) return false;

  // 多局制：仅有局数汇总（如 2:0）而无逐局明细 → 视为未录入
  if (bestOf > 1) return false;

  return true;
}

/** 清除退赛时误写入的默认比分（如旧数据 2:0） */
export function sanitizeRetiredMatch(m: Match, bestOf: BestOf): Match {
  if (!isRetired(m)) return m;
  if (matchHasRecordedScore(m, bestOf)) return m;
  return {
    ...m,
    scoreA: null,
    scoreB: null,
    tiebreakA: 0,
    tiebreakB: 0,
    sets: [],
  };
}

/** 退赛：有已录比分则保留；无比分则不写入 2:0 等默认分 */
export function applyRetirementScores(
  retiredSide: RetiredSide,
  match: Pick<Match, 'scoreA' | 'scoreB' | 'tiebreakA' | 'tiebreakB' | 'sets'>,
  bestOf: BestOf,
): Pick<Match, 'scoreA' | 'scoreB' | 'tiebreakA' | 'tiebreakB' | 'sets' | 'playedAt' | 'retiredSide'> {
  const playedAt = new Date().toISOString();
  if (matchHasRecordedScore(match, bestOf)) {
    return {
      retiredSide,
      scoreA: match.scoreA,
      scoreB: match.scoreB,
      tiebreakA: match.tiebreakA,
      tiebreakB: match.tiebreakB,
      sets: match.sets ?? [],
      playedAt,
    };
  }
  return {
    retiredSide,
    scoreA: null,
    scoreB: null,
    tiebreakA: 0,
    tiebreakB: 0,
    sets: [],
    playedAt,
  };
}

export function getMatchWinnerSide(
  m: Pick<Match, 'retiredSide' | 'scoreA' | 'scoreB' | 'sets' | 'isBye'>,
  bestOf: BestOf,
): 'A' | 'B' | null {
  if (m.isBye) return null;
  if (m.retiredSide === 'A') return 'B';
  if (m.retiredSide === 'B') return 'A';
  if (m.scoreA === null || m.scoreB === null) {
    const completed = (m.sets ?? []).filter(isCompleteSetScore);
    if (!isMatchDecided(completed, bestOf)) return null;
    const { winsA, winsB } = countSetWins(completed);
    if (winsA > winsB) return 'A';
    if (winsB > winsA) return 'B';
    return null;
  }
  if (m.scoreA > m.scoreB) return 'A';
  if (m.scoreB > m.scoreA) return 'B';
  return null;
}

export function winnerIdsForSide(
  m: Pick<Match, 'sideAIds' | 'sideBIds'>,
  side: 'A' | 'B',
): string[] {
  return side === 'A' ? m.sideAIds : m.sideBIds;
}
