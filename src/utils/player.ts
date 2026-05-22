import {
  DEFAULT_PLAYER_GENDER,
  DEFAULT_PLAYER_LEVEL,
  PLAYER_LEVELS,
  type MatchMode,
  type Player,
  type PlayerGender,
  type PlayerLevel,
} from '../types';
import { getActiveStrings } from '../i18n';
import { genderSymbol } from './gender';
export function isPlayerLevel(n: number): n is PlayerLevel {
  return PLAYER_LEVELS.includes(n as PlayerLevel);
}

export function normalizePlayer(raw: Partial<Player> & { id: string; name: string }): Player {
  const gender: PlayerGender =
    raw.gender === 'male' || raw.gender === 'female' || raw.gender === 'unspecified'
      ? raw.gender
      : DEFAULT_PLAYER_GENDER;
  const level =
    typeof raw.level === 'number' && isPlayerLevel(raw.level)
      ? raw.level
      : DEFAULT_PLAYER_LEVEL;
  return { id: raw.id, name: raw.name, gender, level };
}

export function normalizePlayers(players: Array<Partial<Player> & { id: string; name: string }>): Player[] {
  return players.map(normalizePlayer);
}

export function formatPlayerLabel(
  player: Player,
  showGender = true,
): string {
  const meta: string[] = [];
  if (showGender) meta.push(genderSymbol(player.gender));
  meta.push(getActiveStrings().levelLabel(player.level));
  return `${player.name} (${meta.join(' ')})`;
}

export function formatPlayerBadge(
  player: Player,
  showGender = true,
): string {
  const meta: string[] = [];
  if (showGender) meta.push(genderSymbol(player.gender));
  meta.push(getActiveStrings().levelLabel(player.level));
  return `(${meta.join(' ')})`;
}

function playerSlotNumber(playerId: string, players: Player[]): number {
  const index = players.findIndex((p) => p.id === playerId);
  return index >= 0 ? index + 1 : 0;
}

/** 对阵表单行：单打为签位号，双打为 1&2 形式 */
export function formatScheduleSideLabel(
  sideIds: string[],
  players: Player[],
  mode: MatchMode,
): string {
  if (sideIds.length === 0) return '?';
  if (mode === 'singles') {
    const n = playerSlotNumber(sideIds[0], players);
    return n > 0 ? String(n) : '?';
  }
  const nums = sideIds
    .map((id) => playerSlotNumber(id, players))
    .filter((n) => n > 0)
    .sort((a, b) => a - b);
  return nums.length > 0 ? nums.join('&') : '?';
}

/** 对阵表一行：如 1&2vs3&4 或 1vs2 */
export function formatScheduleMatchLine(
  sideAIds: string[],
  sideBIds: string[],
  players: Player[],
  mode: MatchMode,
): string {
  const a = formatScheduleSideLabel(sideAIds, players, mode);
  const b = formatScheduleSideLabel(sideBIds, players, mode);
  return `${a} vs ${b}`;
}

/** 比分卡片用：姓名 + 性别符号（纯文本，供回调兼容） */
export function formatSideCompactLabel(
  sideIds: string[],
  players: Player[],
  showGender = true,
): string {
  return sideIds
    .map((id) => {
      const p = players.find((pl) => pl.id === id);
      if (!p) return '?';
      const meta: string[] = [];
      if (showGender) meta.push(genderSymbol(p.gender));
      meta.push(getActiveStrings().levelLabel(p.level));
      return `${p.name} (${meta.join(' ')})`;
    })
    .join('/');
}
