import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Match,
  MatchMode,
  Player,
  PlayerGender,
  PlayerLevel,
  BestOf,
  BestOfMode,
  ScheduleFormat,
  ScheduleSeedMode,
  SetScore,
  TabId,
  Tournament,
  TournamentCategory,
} from '../types';
import {
  DEFAULT_BEST_OF,
  DEFAULT_BEST_OF_MODE,
  DEFAULT_CUSTOM_BEST_OF_DEFAULT,
  DEFAULT_CUSTOM_BEST_OF_FINAL,
  DEFAULT_GROUP_COUNT,
  DEFAULT_SCHEDULE_SEED_MODE,
  DEFAULT_TOURNAMENT_CATEGORY,
} from '../types';
import { normalizeBestOf, resolveMatchBestOf } from '../utils/bestOf';
import { normalizePlayers } from '../utils/player';
import { getActiveStrings } from '../i18n';
import { formatSideCompactLabel } from '../utils/player';
import {
  defaultGenderForCategory,
  normalizePlayersForCategory,
  showPlayerGender,
} from '../utils/tournamentCategory';
import { resolveMatchSides } from '../utils/knockout';
import type { RetiredSide } from '../utils/matchOutcome';
import {
  applyRetirementScores,
  sanitizeRetiredMatch,
} from '../utils/matchOutcome';
import { applySetsToMatchScores, isValidMatchScore } from '../utils/score';
import { normalizeSetScores } from '../utils/sets';
import {
  autoPairPlayers,
  buildGroupStageSchedule,
  buildKnockoutOnlySchedule,
  buildRoundRobinSchedule,
  validateBeforeSchedule,
} from '../utils/schedule';
import {
  MAX_BULK_PLAYER_COUNT,
  syncPlayersByCount,
} from '../utils/bulkPlayers';

export { MAX_BULK_PLAYER_COUNT };

function uid(): string {
  return crypto.randomUUID();
}

function compactLabelForTournament(t: Tournament) {
  const showGender = showPlayerGender(t.category);
  return (sideIds: string[], players: Player[]) =>
    formatSideCompactLabel(sideIds, players, showGender);
}

function emptyTournament(): Tournament {
  const now = new Date().toISOString();
  const S = getActiveStrings();
  return {
    id: uid(),
    name: S.defaultTournamentName,
    description: '',
    category: DEFAULT_TOURNAMENT_CATEGORY,
    mode: 'singles',
    scheduleFormat: 'round_robin',
    scheduleSeedMode: DEFAULT_SCHEDULE_SEED_MODE,
    bestOfMode: DEFAULT_BEST_OF_MODE,
    bestOf: DEFAULT_BEST_OF,
    customBestOfDefault: DEFAULT_CUSTOM_BEST_OF_DEFAULT,
    customBestOfFinal: DEFAULT_CUSTOM_BEST_OF_FINAL,
    groupCount: DEFAULT_GROUP_COUNT,
    groups: [],
    players: [],
    teams: [],
    matches: [],
    createdAt: now,
  };
}

interface TournamentState {
  tournament: Tournament;
  activeTab: TabId;
  setActiveTab: (tab: TabId) => void;
  setTournamentName: (name: string) => void;
  setTournamentDescription: (description: string) => void;
  setTournamentCategory: (category: TournamentCategory) => void;
  setMode: (mode: MatchMode) => void;
  setScheduleFormat: (format: ScheduleFormat) => void;
  setScheduleSeedMode: (mode: ScheduleSeedMode) => void;
  setBestOfMode: (mode: BestOfMode) => void;
  setBestOf: (bestOf: BestOf) => void;
  setCustomBestOfDefault: (bestOf: BestOf) => void;
  setCustomBestOfFinal: (bestOf: BestOf) => void;
  setGroupCount: (count: number) => void;
  addPlayer: (name: string, gender: PlayerGender, level: PlayerLevel) => void;
  addPlayersByCount: (
    count: number,
    gender: PlayerGender,
    level: PlayerLevel,
  ) => void;
  removePlayers: (ids: string[]) => void;
  clearAllPlayers: () => void;
  removePlayer: (id: string) => void;
  updatePlayer: (
    id: string,
    patch: Partial<Pick<Player, 'name' | 'gender' | 'level'>>,
  ) => void;
  autoPairTeams: () => void;
  setTeamPair: (teamIndex: number, playerAId: string, playerBId: string) => void;
  generateSchedule: () => string | null;
  updateMatchScore: (
    matchId: string,
    scoreA: number,
    scoreB: number,
    tiebreakA?: number,
    tiebreakB?: number,
  ) => void;
  updateMatchSets: (matchId: string, sets: SetScore[]) => void;
  setMatchRetirement: (matchId: string, retiredSide: RetiredSide | null) => void;
  clearMatchScore: (matchId: string) => void;
  resetTournament: () => void;
}

export const useTournamentStore = create<TournamentState>()(
  persist(
    (set, get) => ({
      tournament: emptyTournament(),
      activeTab: 'players',

      setActiveTab: (tab) => set({ activeTab: tab }),

      setTournamentName: (name) =>
        set((s) => ({
          tournament: { ...s.tournament, name },
        })),

      setTournamentDescription: (description) =>
        set((s) => ({
          tournament: { ...s.tournament, description },
        })),

      setTournamentCategory: (category) =>
        set((s) => ({
          tournament: {
            ...s.tournament,
            category,
            players: normalizePlayersForCategory(s.tournament.players, category),
          },
        })),

      setMode: (mode) =>
        set((s) => {
          const players = s.tournament.players;
          const teams =
            mode === 'doubles' && players.length >= 2
              ? autoPairPlayers(players)
              : [];
          return {
            tournament: {
              ...s.tournament,
              mode,
              teams,
              matches: [],
              groups: [],
            },
          };
        }),

      setScheduleFormat: (scheduleFormat) =>
        set((s) => {
          const wasCustom = s.tournament.bestOfMode === 'custom';
          return {
            tournament: {
              ...s.tournament,
              scheduleFormat,
              bestOfMode:
                scheduleFormat === 'round_robin' ? 'uniform' : s.tournament.bestOfMode,
              bestOf:
                scheduleFormat === 'round_robin' && wasCustom
                  ? s.tournament.customBestOfDefault
                  : s.tournament.bestOf,
              matches: [],
              groups: [],
            },
          };
        }),

      setScheduleSeedMode: (scheduleSeedMode) =>
        set((s) => ({
          tournament: { ...s.tournament, scheduleSeedMode },
        })),

      setBestOfMode: (bestOfMode) =>
        set((s) => {
          if (s.tournament.scheduleFormat === 'round_robin') return s;
          return {
            tournament: {
              ...s.tournament,
              bestOfMode,
              matches: [],
              groups: [],
            },
          };
        }),

      setBestOf: (bestOf) =>
        set((s) => ({
          tournament: {
            ...s.tournament,
            bestOf,
            matches: [],
            groups: [],
          },
        })),

      setCustomBestOfDefault: (customBestOfDefault) =>
        set((s) => ({
          tournament: {
            ...s.tournament,
            customBestOfDefault,
            matches: [],
            groups: [],
          },
        })),

      setCustomBestOfFinal: (customBestOfFinal) =>
        set((s) => ({
          tournament: {
            ...s.tournament,
            customBestOfFinal,
            matches: [],
            groups: [],
          },
        })),

      setGroupCount: (groupCount) =>
        set((s) => ({
          tournament: {
            ...s.tournament,
            groupCount: Math.max(2, Math.min(32, groupCount)),
            matches: [],
            groups: [],
          },
        })),

      addPlayer: (name, gender, level) => {
        const trimmed = name.trim();
        if (!trimmed) return;
        set((s) => {
          const effectiveGender = showPlayerGender(s.tournament.category)
            ? gender
            : defaultGenderForCategory(s.tournament.category);
          const players = [
            ...s.tournament.players,
            { id: uid(), name: trimmed, gender: effectiveGender, level },
          ];
          const teams =
            s.tournament.mode === 'doubles'
              ? autoPairPlayers(players)
              : s.tournament.teams;
          return {
            tournament: {
              ...s.tournament,
              players,
              teams,
              matches: [],
              groups: [],
            },
          };
        });
      },

      addPlayersByCount: (count, gender, level) => {
        set((s) => {
          const effectiveGender = showPlayerGender(s.tournament.category)
            ? gender
            : defaultGenderForCategory(s.tournament.category);
          const players = syncPlayersByCount(
            s.tournament.players,
            count,
            effectiveGender,
            level,
            uid,
          );
          const teams =
            s.tournament.mode === 'doubles'
              ? autoPairPlayers(players)
              : s.tournament.teams;
          return {
            tournament: {
              ...s.tournament,
              players,
              teams,
              matches: [],
              groups: [],
            },
          };
        });
      },

      removePlayers: (ids) => {
        if (ids.length === 0) return;
        const idSet = new Set(ids);
        set((s) => {
          const players = s.tournament.players.filter((p) => !idSet.has(p.id));
          const teams =
            s.tournament.mode === 'doubles'
              ? autoPairPlayers(players)
              : [];
          const matches = s.tournament.matches.filter(
            (m) =>
              !m.sideAIds.some((pid) => idSet.has(pid)) &&
              !m.sideBIds.some((pid) => idSet.has(pid)),
          );
          return {
            tournament: { ...s.tournament, players, teams, matches, groups: [] },
          };
        });
      },

      clearAllPlayers: () =>
        set((s) => ({
          tournament: {
            ...s.tournament,
            players: [],
            teams: [],
            matches: [],
            groups: [],
          },
        })),

      removePlayer: (id) =>
        set((s) => {
          const players = s.tournament.players.filter((p) => p.id !== id);
          const teams =
            s.tournament.mode === 'doubles'
              ? autoPairPlayers(players)
              : [];
          const matches = s.tournament.matches.filter(
            (m) =>
              !m.sideAIds.includes(id) && !m.sideBIds.includes(id),
          );
          return {
            tournament: { ...s.tournament, players, teams, matches, groups: [] },
          };
        }),

      updatePlayer: (id, patch) =>
        set((s) => ({
          tournament: {
            ...s.tournament,
            players: s.tournament.players.map((p) =>
              p.id === id ? { ...p, ...patch } : p,
            ),
          },
        })),

      autoPairTeams: () =>
        set((s) => ({
          tournament: {
            ...s.tournament,
            teams: autoPairPlayers(s.tournament.players),
            matches: [],
            groups: [],
          },
        })),

      setTeamPair: (teamIndex, playerAId, playerBId) =>
        set((s) => {
          const teams = [...s.tournament.teams];
          if (teamIndex < 0 || teamIndex >= teams.length) return s;
          teams[teamIndex] = {
            ...teams[teamIndex],
            playerIds: [playerAId, playerBId],
          };
          return {
            tournament: { ...s.tournament, teams, matches: [], groups: [] },
          };
        }),

      generateSchedule: () => {
        const { tournament } = get();
        const err = validateBeforeSchedule(
          tournament.mode,
          tournament.players,
          tournament.teams,
          tournament.scheduleFormat,
          tournament.groupCount,
        );
        if (err) return err;

        const seedMode = tournament.scheduleSeedMode;
        const result =
          tournament.scheduleFormat === 'group_stage'
            ? buildGroupStageSchedule(
                tournament.players,
                tournament.teams,
                tournament.mode,
                tournament.groupCount,
                seedMode,
              )
            : tournament.scheduleFormat === 'knockout'
              ? buildKnockoutOnlySchedule(
                  tournament.players,
                  tournament.teams,
                  tournament.mode,
                  seedMode,
                )
              : buildRoundRobinSchedule(
                  tournament.players,
                  tournament.teams,
                  tournament.mode,
                  seedMode,
                );

        set((s) => ({
          tournament: {
            ...s.tournament,
            matches: result.matches,
            groups: result.groups,
          },
        }));
        return null;
      },

      updateMatchScore: (matchId, scoreA, scoreB, tiebreakA = 0, tiebreakB = 0) =>
        set((s) => {
          const t = s.tournament;
          const target = t.matches.find((m) => m.id === matchId);
          if (!target || target.isBye) return s;
          const matchBestOf = resolveMatchBestOf(target, t);
          if (!isValidMatchScore(scoreA, scoreB, matchBestOf)) return s;
          const tbA = matchBestOf === 1 ? tiebreakA : 0;
          const tbB = matchBestOf === 1 ? tiebreakB : 0;
          return {
            tournament: {
              ...t,
              matches: t.matches.map((m) => {
                if (m.id !== matchId) return m;
                const resolved = resolveMatchSides(m, t, compactLabelForTournament(t));
                return {
                  ...m,
                  sideAIds:
                    m.phase === 'knockout' && resolved.ready
                      ? resolved.sideAIds
                      : m.sideAIds,
                  sideBIds:
                    m.phase === 'knockout' && resolved.ready
                      ? resolved.sideBIds
                      : m.sideBIds,
                  scoreA,
                  scoreB,
                  tiebreakA: tbA,
                  tiebreakB: tbB,
                  sets: [],
                  retiredSide: null,
                  playedAt: new Date().toISOString(),
                };
              }),
            },
          };
        }),

      updateMatchSets: (matchId, sets) =>
        set((s) => {
          const t = s.tournament;
          const target = t.matches.find((m) => m.id === matchId);
          if (!target || target.isBye) return s;
          const matchBestOf = resolveMatchBestOf(target, t);
          if (matchBestOf === 1) return s;
          const applied = applySetsToMatchScores(sets, matchBestOf);
          return {
            tournament: {
              ...t,
              matches: t.matches.map((m) => {
                if (m.id !== matchId) return m;
                const resolved = resolveMatchSides(m, t, compactLabelForTournament(t));
                return {
                  ...m,
                  sideAIds:
                    m.phase === 'knockout' && resolved.ready
                      ? resolved.sideAIds
                      : m.sideAIds,
                  sideBIds:
                    m.phase === 'knockout' && resolved.ready
                      ? resolved.sideBIds
                      : m.sideBIds,
                  ...applied,
                };
              }),
            },
          };
        }),

      setMatchRetirement: (matchId, retiredSide) =>
        set((s) => {
          const t = s.tournament;
          const target = t.matches.find((m) => m.id === matchId);
          if (!target || target.isBye) return s;
          return {
            tournament: {
              ...t,
              matches: t.matches.map((m) => {
                if (m.id !== matchId) return m;
                const resolved = resolveMatchSides(m, t, compactLabelForTournament(t));
                const base = {
                  ...m,
                  sideAIds:
                    m.phase === 'knockout' && resolved.ready
                      ? resolved.sideAIds
                      : m.sideAIds,
                  sideBIds:
                    m.phase === 'knockout' && resolved.ready
                      ? resolved.sideBIds
                      : m.sideBIds,
                };
                if (!retiredSide) {
                  return { ...base, retiredSide: null };
                }
                const matchBestOf = resolveMatchBestOf(base, t);
                return sanitizeRetiredMatch(
                  {
                    ...base,
                    ...applyRetirementScores(retiredSide, base, matchBestOf),
                  },
                  matchBestOf,
                );
              }),
            },
          };
        }),

      clearMatchScore: (matchId) =>
        set((s) => {
          const target = s.tournament.matches.find((m) => m.id === matchId);
          if (!target || target.isBye) return s;
          return {
            tournament: {
              ...s.tournament,
              matches: s.tournament.matches.map((m) =>
                m.id === matchId
                  ? {
                      ...m,
                      scoreA: null,
                      scoreB: null,
                      tiebreakA: 0,
                      tiebreakB: 0,
                      sets: [],
                      retiredSide: null,
                      playedAt: null,
                    }
                  : m,
              ),
            },
          };
        }),

      resetTournament: () =>
        set({
          tournament: emptyTournament(),
          activeTab: 'players',
        }),
    }),
    {
      name: 'tennis-score-tournament-v4',
      partialize: (state) => ({
        tournament: state.tournament,
        activeTab: state.activeTab,
      }),
      merge: (persisted, current) => {
        const p = persisted as Partial<typeof current> | undefined;
        if (!p?.tournament) return current;
        const raw = p.tournament;
        const scheduleFormat =
          raw.scheduleFormat === 'group_stage'
            ? 'group_stage'
            : raw.scheduleFormat === 'knockout'
              ? 'knockout'
              : 'round_robin';
        return {
          ...current,
          ...p,
          tournament: {
            ...current.tournament,
            ...raw,
            scheduleFormat,
            scheduleSeedMode:
              (raw as Tournament).scheduleSeedMode === 'sequential'
                ? 'sequential'
                : DEFAULT_SCHEDULE_SEED_MODE,
            bestOfMode:
              scheduleFormat === 'round_robin'
                ? 'uniform'
                : (raw as Tournament).bestOfMode === 'custom'
                  ? 'custom'
                  : 'uniform',
            bestOf: normalizeBestOf((raw as Tournament).bestOf),
            customBestOfDefault: normalizeBestOf(
              (raw as Tournament).customBestOfDefault ?? DEFAULT_CUSTOM_BEST_OF_DEFAULT,
            ),
            customBestOfFinal: normalizeBestOf(
              (raw as Tournament).customBestOfFinal ?? DEFAULT_CUSTOM_BEST_OF_FINAL,
            ),
            groupCount:
              typeof raw.groupCount === 'number' && raw.groupCount >= 2
                ? raw.groupCount
                : DEFAULT_GROUP_COUNT,
            groups: raw.groups ?? [],
            description:
              typeof (raw as Tournament).description === 'string'
                ? (raw as Tournament).description
                : '',
            category:
              (raw as Tournament).category === 'women'
                ? 'women'
                : (raw as Tournament).category === 'mixed'
                  ? 'mixed'
                  : DEFAULT_TOURNAMENT_CATEGORY,
            players: normalizePlayersForCategory(
              normalizePlayers(raw.players ?? []),
              (raw as Tournament).category === 'women'
                ? 'women'
                : (raw as Tournament).category === 'mixed'
                  ? 'mixed'
                  : DEFAULT_TOURNAMENT_CATEGORY,
            ),
            matches: (() => {
              const rawMatches = raw.matches ?? [];
              const filtered =
                scheduleFormat === 'round_robin'
                  ? rawMatches
                  : rawMatches.filter(
                      (m) =>
                        (m as Match).knockoutStage !== 'third',
                    );
              const bestOfCtx = {
                scheduleFormat,
                bestOfMode:
                  scheduleFormat === 'round_robin'
                    ? 'uniform'
                    : (raw as Tournament).bestOfMode === 'custom'
                      ? 'custom'
                      : 'uniform',
                bestOf: normalizeBestOf((raw as Tournament).bestOf),
                customBestOfDefault: normalizeBestOf(
                  (raw as Tournament).customBestOfDefault ??
                    DEFAULT_CUSTOM_BEST_OF_DEFAULT,
                ),
                customBestOfFinal: normalizeBestOf(
                  (raw as Tournament).customBestOfFinal ??
                    DEFAULT_CUSTOM_BEST_OF_FINAL,
                ),
              } as const;
              return filtered.map((m, idx) => {
              const legacy = m as Match & {
                round?: number;
                phase?: Match['phase'];
                knockoutStage?: Match['knockoutStage'];
                knockoutRank?: Match['knockoutRank'];
                slotA?: Match['slotA'];
                slotB?: Match['slotB'];
              };
              const phase =
                legacy.phase ??
                (legacy.knockoutStage || legacy.slotA ? 'knockout' : 'group');
              const row: Match = {
                ...legacy,
                phase,
                group: legacy.group ?? null,
                knockoutStage: legacy.knockoutStage ?? null,
                knockoutRank:
                  typeof legacy.knockoutRank === 'number'
                    ? legacy.knockoutRank
                    : legacy.phase === 'knockout' || legacy.knockoutStage
                      ? 1
                      : null,
                slotA: legacy.slotA ?? null,
                slotB: legacy.slotB ?? null,
                order: typeof legacy.order === 'number' ? legacy.order : idx + 1,
                tiebreakA: typeof legacy.tiebreakA === 'number' ? legacy.tiebreakA : 0,
                tiebreakB: typeof legacy.tiebreakB === 'number' ? legacy.tiebreakB : 0,
                sets: normalizeSetScores(
                  (legacy as Match & { sets?: unknown }).sets,
                ),
                retiredSide:
                  (legacy as Match & { retiredSide?: string }).retiredSide === 'A' ||
                  (legacy as Match & { retiredSide?: string }).retiredSide === 'B'
                    ? ((legacy as Match & { retiredSide: 'A' | 'B' }).retiredSide)
                    : null,
                isBye: legacy.isBye === true,
              };
              const bo = resolveMatchBestOf(row, bestOfCtx);
              return sanitizeRetiredMatch(row, bo);
              });
            })(),
          },
        };
      },
    },
  ),
);
