export type MatchMode = 'singles' | 'doubles';

/** 双打搭档：固定队伍，或轮换/自动配对 */
export type DoublesPairing = 'fixed' | 'rotating';

/** 赛事类别：男子 / 女子 / 混合（仅混合赛录入与展示性别） */
export type TournamentCategory = 'men' | 'women' | 'mixed';

export type ScheduleFormat = 'round_robin' | 'group_stage' | 'knockout';

/** 生成对阵时的签位/分组顺序 */
export type ScheduleSeedMode = 'sequential' | 'random';

/** 每场对阵赛制：bo1 一局定胜负；bo3/bo5 录入双方赢下的局（盘）数 */
export type BestOf = 1 | 3 | 5;

/** 统一全场 bo，或按「其他 / 决赛」自定义 */
export type BestOfMode = 'uniform' | 'custom';

export type TabId = 'players' | 'setup' | 'matches' | 'rankings';

export type PlayerGender = 'male' | 'female' | 'unspecified';

export type PlayerLevel = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;

export type MatchPhase = 'group' | 'knockout';

/** 淘汰赛阶段 */
export type KnockoutStage = 'cross' | 'quarter' | 'semi' | 'third' | 'final' | 'bye';

/** 小组内名次占位（1 为小组第一） */
export interface GroupRankSlot {
  kind: 'group_rank';
  group: number;
  rank: number;
}

/** 引用上一场淘汰赛的胜者/负者 */
export interface MatchResultSlot {
  kind: 'winner' | 'loser';
  matchId: string;
}

export type KnockoutSlot = GroupRankSlot | MatchResultSlot;

export interface Player {
  id: string;
  name: string;
  gender: PlayerGender;
  level: PlayerLevel;
}

export interface Team {
  id: string;
  playerIds: [string, string];
}

export interface GroupAssignment {
  id: number;
  memberIds: string[];
}

/** 单局比分（大分=局内胜局数，小分=抢七） */
export interface SetScore {
  gamesA: number;
  gamesB: number;
  tiebreakA: number;
  tiebreakB: number;
}

export interface Match {
  id: string;
  phase: MatchPhase;
  /** 小组赛组别（1 起）；淘汰赛为 null */
  group: number | null;
  knockoutStage: KnockoutStage | null;
  /** 对应小组名次（第几名）的淘汰赛，循环赛为 null */
  knockoutRank: number | null;
  slotA: KnockoutSlot | null;
  slotB: KnockoutSlot | null;
  order: number;
  sideAIds: string[];
  sideBIds: string[];
  scoreA: number | null;
  scoreB: number | null;
  tiebreakA: number;
  tiebreakB: number;
  /** bo3/bo5 逐局明细；bo1 为空数组 */
  sets: SetScore[];
  /** 退赛方：A 或 B 退赛，对方直接获胜 */
  retiredSide: 'A' | 'B' | null;
  playedAt: string | null;
  /** 轮空直接晋级，无需录入比分 */
  isBye: boolean;
  /** 对战表手动标记为完赛（与比分录入无关） */
  scheduleMarkedDone: boolean;
}

export interface Tournament {
  id: string;
  name: string;
  /** 赛事说明（规则、地点、备注等） */
  description: string;
  category: TournamentCategory;
  mode: MatchMode;
  /** 双打时：固定队友可手动编组；轮换搭档则按签位自动/随机配对 */
  doublesPairing: DoublesPairing;
  scheduleFormat: ScheduleFormat;
  /** 生成对阵：按球员列表顺序，或随机打乱 */
  scheduleSeedMode: ScheduleSeedMode;
  bestOfMode: BestOfMode;
  /** 统一赛制时使用 */
  bestOf: BestOf;
  /** 自定义：小组赛、淘汰非决赛等 */
  customBestOfDefault: BestOf;
  /** 自定义：淘汰赛决赛 */
  customBestOfFinal: BestOf;
  groupCount: number;
  groups: GroupAssignment[];
  players: Player[];
  teams: Team[];
  matches: Match[];
  /** 每次生成/追加对阵的场次数量，用于分块展示对阵矩阵 */
  scheduleBatchSizes: number[];
  createdAt: string;
}

export interface StandingRow {
  id: string;
  label: string;
  played: number;
  wins: number;
  losses: number;
  gamesFor: number;
  gamesAgainst: number;
  gameDiff: number;
  winRate: number;
  rank: number;
}

export const PLAYER_LEVELS: PlayerLevel[] = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export const DEFAULT_TOURNAMENT_CATEGORY: TournamentCategory = 'men';

export const DEFAULT_PLAYER_GENDER: PlayerGender = 'male';

export const DEFAULT_PLAYER_LEVEL: PlayerLevel = 3;

export const DEFAULT_GROUP_COUNT = 2;
export const DEFAULT_SCHEDULE_SEED_MODE: ScheduleSeedMode = 'random';
export const DEFAULT_DOUBLES_PAIRING: DoublesPairing = 'fixed';

export const DEFAULT_BEST_OF: BestOf = 1;
export const DEFAULT_BEST_OF_MODE: BestOfMode = 'uniform';
export const DEFAULT_CUSTOM_BEST_OF_DEFAULT: BestOf = 3;
export const DEFAULT_CUSTOM_BEST_OF_FINAL: BestOf = 5;
