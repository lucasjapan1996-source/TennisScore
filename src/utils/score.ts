import { getActiveStrings } from '../i18n';
import type { BestOf, Match, SetScore } from '../types';
import { isRetired } from './matchOutcome';
import { countSetWins, isCompleteSetScore, isMatchDecided } from './sets';

export function setsToWin(bestOf: BestOf): number {
  return Math.ceil(bestOf / 2);
}

/** 校验已录入的比分是否符合 bo 赛制 */
export function isValidMatchScore(
  scoreA: number,
  scoreB: number,
  bestOf: BestOf,
): boolean {
  if (scoreA === scoreB) return false;
  if (bestOf === 1) {
    return scoreA >= 0 && scoreB >= 0;
  }
  const win = setsToWin(bestOf);
  const maxLoser = bestOf - win;
  const hi = Math.max(scoreA, scoreB);
  const lo = Math.min(scoreA, scoreB);
  return hi === win && lo >= 0 && lo <= maxLoser;
}

export function parseSmallScore(raw: string): number {
  const t = raw.trim();
  if (t === '') return 0;
  const n = parseInt(t, 10);
  return Number.isNaN(n) || n < 0 ? 0 : n;
}

/** 大分录入：双边皆空清除；单边留空视为 0 */
export function parseBigScorePair(
  rawA: string,
  rawB: string,
): { scoreA: number; scoreB: number } | 'clear' | null {
  const trimmedA = rawA.trim();
  const trimmedB = rawB.trim();
  if (trimmedA === '' && trimmedB === '') return 'clear';
  const na = trimmedA === '' ? 0 : parseInt(trimmedA, 10);
  const nb = trimmedB === '' ? 0 : parseInt(trimmedB, 10);
  if (Number.isNaN(na) || Number.isNaN(nb) || na < 0 || nb < 0) return null;
  return { scoreA: na, scoreB: nb };
}

export function formatSideScore(big: number, tiebreak: number): string {
  if (tiebreak > 0) return `${big}(${tiebreak})`;
  return String(big);
}

function sideKey(ids: string[]): string {
  return [...ids].sort().join(',');
}

/** 按「行方 : 列方」视角格式化（矩阵单元格用） */
export function formatMatchScoreForRow(m: Match, rowSideIds: string[]): string {
  if (m.scoreA === null || m.scoreB === null) return '';
  const rowKey = sideKey(rowSideIds);
  if (rowKey === sideKey(m.sideAIds)) {
    return `${formatSideScore(m.scoreA, m.tiebreakA)} : ${formatSideScore(m.scoreB, m.tiebreakB)}`;
  }
  return `${formatSideScore(m.scoreB, m.tiebreakB)} : ${formatSideScore(m.scoreA, m.tiebreakA)}`;
}

function formatSetLine(s: SetScore): string {
  return `${formatSideScore(s.gamesA, s.tiebreakA)}-${formatSideScore(s.gamesB, s.tiebreakB)}`;
}

/** 比分数字部分（不含退赛标记） */
function formatMatchScoreBody(m: Match): string {
  const completedSets = (m.sets ?? []).filter(isCompleteSetScore);
  if (completedSets.length > 0) {
    const { winsA, winsB } = countSetWins(completedSets);
    const detail = completedSets.map(formatSetLine).join(', ');
    if (m.scoreA !== null && m.scoreB !== null) {
      return `${m.scoreA}:${m.scoreB} (${detail})`;
    }
    return `${winsA}:${winsB} (${detail})`;
  }
  if (m.scoreA === null || m.scoreB === null) return '';
  return `${formatSideScore(m.scoreA, m.tiebreakA)} : ${formatSideScore(m.scoreB, m.tiebreakB)}`;
}

export function formatMatchScore(m: Match): string {
  if (m.isBye) return '';
  if (isRetired(m)) {
    const S = getActiveStrings();
    const body = formatMatchScoreBody(m);
    if (body) {
      return `${body.replace(' : ', ':')} ${S.retiredTag}`;
    }
    return S.retiredTag;
  }
  return formatMatchScoreBody(m);
}

/** 排名页比赛比分：仅显示比分，退赛无录入时为 0 : 0 */
export function formatMatchResultsScore(m: Match): string {
  if (m.isBye) return '';
  const body = formatMatchScoreBody(m);
  if (body) return body;
  if (isRetired(m)) return '0 : 0';
  return '';
}

export function isMatchPlayed(m: Match): boolean {
  if (m.isBye) return false;
  if (isRetired(m)) return true;
  return m.scoreA !== null && m.scoreB !== null;
}

export function applySetsToMatchScores(
  sets: SetScore[],
  bestOf: BestOf,
): Pick<
  Match,
  'sets' | 'scoreA' | 'scoreB' | 'tiebreakA' | 'tiebreakB' | 'playedAt' | 'retiredSide'
> {
  const completed = sets.filter(isCompleteSetScore);
  const { winsA, winsB } = countSetWins(completed);
  const decided = isMatchDecided(completed, bestOf);
  return {
    sets: completed,
    scoreA: decided ? winsA : null,
    scoreB: decided ? winsB : null,
    tiebreakA: 0,
    tiebreakB: 0,
    retiredSide: null,
    playedAt: decided ? new Date().toISOString() : null,
  };
}
