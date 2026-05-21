import type { BestOf, Match, Tournament } from '../types';

export function normalizeBestOf(value: unknown): BestOf {
  return value === 3 || value === 5 ? value : 1;
}

export type BestOfTournamentFields = Pick<
  Tournament,
  | 'scheduleFormat'
  | 'bestOfMode'
  | 'bestOf'
  | 'customBestOfDefault'
  | 'customBestOfFinal'
>;

export type StandingTournamentFields = BestOfTournamentFields &
  Pick<Tournament, 'category'>;

/** 按赛事配置解析单场对阵的 bo 赛制 */
export function resolveMatchBestOf(
  match: Pick<Match, 'phase' | 'knockoutStage' | 'isBye'>,
  tournament: BestOfTournamentFields,
): BestOf {
  if (
    tournament.scheduleFormat === 'round_robin' ||
    tournament.bestOfMode === 'uniform'
  ) {
    return tournament.bestOf;
  }
  if (
    match.phase === 'knockout' &&
    match.knockoutStage === 'final' &&
    !match.isBye
  ) {
    return tournament.customBestOfFinal;
  }
  return tournament.customBestOfDefault;
}

export function tournamentHasFinal(
  scheduleFormat: Tournament['scheduleFormat'],
): boolean {
  return scheduleFormat === 'knockout' || scheduleFormat === 'group_stage';
}
