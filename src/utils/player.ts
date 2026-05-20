import {
  DEFAULT_PLAYER_GENDER,
  DEFAULT_PLAYER_LEVEL,
  PLAYER_LEVELS,
  type Player,
  type PlayerGender,
  type PlayerLevel,
} from '../types';
import { S } from '../strings';
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

export function formatPlayerLabel(player: Player): string {
  return `${player.name} ${genderSymbol(player.gender)} ${S.levelLabel(player.level)}`;
}

export function formatPlayerBadge(player: Player): string {
  return `${genderSymbol(player.gender)} ${S.levelLabel(player.level)}`;
}

/** 比分卡片用：姓名 + 性别符号（纯文本，供回调兼容） */
export function formatSideCompactLabel(
  sideIds: string[],
  players: Player[],
): string {
  return sideIds
    .map((id) => {
      const p = players.find((pl) => pl.id === id);
      if (!p) return '?';
      return `${p.name} ${genderSymbol(p.gender)}`;
    })
    .join('/');
}
