export type MatchMode = 'singles' | 'doubles';

export type ScheduleFormat = 'round_robin' | 'group_stage' | 'knockout';

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
  playedAt: string | null;
  /** 轮空直接晋级，无需录入比分 */
  isBye: boolean;
}

export interface Tournament {
  id: string;
  name: string;
  mode: MatchMode;
  scheduleFormat: ScheduleFormat;
  groupCount: number;
  groups: GroupAssignment[];
  players: Player[];
  teams: Team[];
  matches: Match[];
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

export const DEFAULT_PLAYER_GENDER: PlayerGender = 'male';

export const DEFAULT_PLAYER_LEVEL: PlayerLevel = 3;

export const DEFAULT_GROUP_COUNT = 2;
