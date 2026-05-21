import type { Player, PlayerGender, PlayerLevel } from '../types';

export const MAX_BULK_PLAYER_COUNT = 64;

/** 是否为纯数字编号（1、2、12…），用于与手动添加的姓名区分 */
export function isNumberedBulkName(name: string): boolean {
  return /^[1-9]\d*$/.test(name.trim());
}

export function parseBulkSlotNumber(name: string): number | null {
  const trimmed = name.trim();
  if (!isNumberedBulkName(trimmed)) return null;
  return parseInt(trimmed, 10);
}

/**
 * 按人数同步编号球员 1…N：保留非编号姓名；移除编号 > N；补齐缺失编号。
 * 可与逐个添加混用。
 */
export function syncPlayersByCount(
  existing: Player[],
  count: number,
  gender: PlayerGender,
  level: PlayerLevel,
  createId: () => string,
): Player[] {
  const capped = Math.min(
    Math.max(1, Math.floor(count)),
    MAX_BULK_PLAYER_COUNT,
  );

  const manual = existing.filter((p) => parseBulkSlotNumber(p.name) === null);
  const slotByNumber = new Map<number, Player>();

  for (const p of existing) {
    const slot = parseBulkSlotNumber(p.name);
    if (slot !== null && slot <= capped) {
      slotByNumber.set(slot, { ...p, gender, level });
    }
  }

  const numbered: Player[] = [];
  for (let i = 1; i <= capped; i++) {
    const found = slotByNumber.get(i);
    if (found) {
      numbered.push(found);
    } else {
      numbered.push({
        id: createId(),
        name: String(i),
        gender,
        level,
      });
    }
  }

  return [...manual, ...numbered];
}

/** @deprecated 使用 syncPlayersByCount */
export function createBulkPlayers(
  count: number,
  existingNames: Iterable<string>,
  gender: PlayerGender,
  level: PlayerLevel,
  createId: () => string,
): Player[] {
  const existing: Player[] = [];
  for (const name of existingNames) {
    existing.push({
      id: 'legacy',
      name,
      gender,
      level,
    });
  }
  return syncPlayersByCount(existing, count, gender, level, createId).filter(
    (p) => p.id !== 'legacy',
  );
}
