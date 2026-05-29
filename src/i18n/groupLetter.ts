/** 小组序号 → 字母（1→A，2→B …） */
export function groupLetter(groupId: number): string {
  if (groupId >= 1 && groupId <= 26) {
    return String.fromCharCode(64 + groupId);
  }
  return String(groupId);
}
