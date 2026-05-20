import type { Match } from '../types';

export function parseSmallScore(raw: string): number {
  const t = raw.trim();
  if (t === '') return 0;
  const n = parseInt(t, 10);
  return Number.isNaN(n) || n < 0 ? 0 : n;
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

export function formatMatchScore(m: Match): string {
  if (m.isBye) return '';
  if (m.scoreA === null || m.scoreB === null) return '';
  return `${formatSideScore(m.scoreA, m.tiebreakA)} : ${formatSideScore(m.scoreB, m.tiebreakB)}`;
}

export function isMatchPlayed(m: Match): boolean {
  return m.scoreA !== null && m.scoreB !== null;
}
