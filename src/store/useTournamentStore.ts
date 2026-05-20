import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  Match,
  MatchMode,
  Player,
  PlayerGender,
  PlayerLevel,
  ScheduleFormat,
  TabId,
  Tournament,
} from '../types';
import { DEFAULT_GROUP_COUNT } from '../types';
import { normalizePlayers } from '../utils/player';
import { S } from '../strings';
import { formatSideCompactLabel } from '../utils/player';
import { resolveMatchSides } from '../utils/knockout';
import {
  autoPairPlayers,
  buildGroupStageSchedule,
  buildKnockoutOnlySchedule,
  buildRoundRobinSchedule,
  validateBeforeSchedule,
} from '../utils/schedule';

function uid(): string {
  return crypto.randomUUID();
}

function emptyTournament(): Tournament {
  const now = new Date().toISOString();
  return {
    id: uid(),
    name: S.defaultTournamentName,
    mode: 'singles',
    scheduleFormat: 'round_robin',
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
  setMode: (mode: MatchMode) => void;
  setScheduleFormat: (format: ScheduleFormat) => void;
  setGroupCount: (count: number) => void;
  addPlayer: (name: string, gender: PlayerGender, level: PlayerLevel) => void;
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
        set((s) => ({
          tournament: {
            ...s.tournament,
            scheduleFormat,
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
          const players = [
            ...s.tournament.players,
            { id: uid(), name: trimmed, gender, level },
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

        const result =
          tournament.scheduleFormat === 'group_stage'
            ? buildGroupStageSchedule(
                tournament.players,
                tournament.teams,
                tournament.mode,
                tournament.groupCount,
              )
            : tournament.scheduleFormat === 'knockout'
              ? buildKnockoutOnlySchedule(
                  tournament.players,
                  tournament.teams,
                  tournament.mode,
                )
              : buildRoundRobinSchedule(
                  tournament.players,
                  tournament.teams,
                  tournament.mode,
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
          return {
            tournament: {
              ...t,
              matches: t.matches.map((m) => {
                if (m.id !== matchId) return m;
                const resolved = resolveMatchSides(m, t, formatSideCompactLabel);
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
                  tiebreakA,
                  tiebreakB,
                  playedAt: new Date().toISOString(),
                };
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
        return {
          ...current,
          ...p,
          tournament: {
            ...current.tournament,
            ...raw,
            scheduleFormat:
              raw.scheduleFormat === 'group_stage'
                ? 'group_stage'
                : raw.scheduleFormat === 'knockout'
                  ? 'knockout'
                  : 'round_robin',
            groupCount:
              typeof raw.groupCount === 'number' && raw.groupCount >= 2
                ? raw.groupCount
                : DEFAULT_GROUP_COUNT,
            groups: raw.groups ?? [],
            players: normalizePlayers(raw.players ?? []),
            matches: (() => {
              const scheduleFormat =
                raw.scheduleFormat === 'group_stage'
                  ? 'group_stage'
                  : raw.scheduleFormat === 'knockout'
                    ? 'knockout'
                    : 'round_robin';
              const rawMatches = raw.matches ?? [];
              const filtered =
                scheduleFormat === 'round_robin'
                  ? rawMatches
                  : rawMatches.filter(
                      (m) =>
                        (m as Match).knockoutStage !== 'third',
                    );
              return filtered;
            })().map((m, idx) => {
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
              return {
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
                isBye: legacy.isBye === true,
              };
            }),
          },
        };
      },
    },
  ),
);
