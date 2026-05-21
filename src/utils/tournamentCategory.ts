import type { Player, PlayerGender, TournamentCategory } from '../types';

export function isMixedCategory(category: TournamentCategory): boolean {
  return category === 'mixed';
}

export function showPlayerGender(category: TournamentCategory): boolean {
  return isMixedCategory(category);
}

export function defaultGenderForCategory(
  category: TournamentCategory,
): PlayerGender {
  return category === 'women' ? 'female' : 'male';
}

export function normalizePlayerForCategory(
  player: Player,
  category: TournamentCategory,
): Player {
  if (isMixedCategory(category)) return player;
  return { ...player, gender: defaultGenderForCategory(category) };
}

export function normalizePlayersForCategory(
  players: Player[],
  category: TournamentCategory,
): Player[] {
  return players.map((p) => normalizePlayerForCategory(p, category));
}
