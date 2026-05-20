import { Fragment, type ReactNode } from 'react';
import type { MatchMode, Player, Team } from '../types';
import { S } from '../strings';
import { GenderSymbol } from './GenderSymbol';

export function PlayerLabel({
  player,
  showLevel = false,
  compact = false,
}: {
  player: Player;
  showLevel?: boolean;
  compact?: boolean;
}) {
  return (
    <span className="player-label">
      {player.name}
      {!compact && ' '}
      <GenderSymbol gender={player.gender} />
      {showLevel && (
        <>
          {' '}
          <span className="player-level">{S.levelLabel(player.level)}</span>
        </>
      )}
    </span>
  );
}

function entityKey(ids: string[]): string {
  return [...ids].sort().join(',');
}

export function renderMatchSides(
  sideIds: string[],
  players: Player[],
  mode: MatchMode,
  teams: Team[] = [],
): ReactNode {
  if (sideIds.length === 0) return S.unknown;

  if (mode === 'singles') {
    const p = players.find((pl) => pl.id === sideIds[0]);
    return p ? <PlayerLabel player={p} showLevel /> : S.unknown;
  }

  const team = teams.find(
    (t) =>
      t.id === sideIds[0] ||
      entityKey(t.playerIds) === entityKey(sideIds) ||
      t.playerIds.every((pid) => sideIds.includes(pid)),
  );
  const ids = team ? [...team.playerIds] : sideIds;

  return ids.map((pid, i) => {
    const p = players.find((pl) => pl.id === pid);
    return (
      <Fragment key={pid}>
        {i > 0 && ' / '}
        {p ? <PlayerLabel player={p} compact /> : S.unknown}
      </Fragment>
    );
  });
}

export function renderStandingName(
  entityId: string,
  players: Player[],
  mode: MatchMode,
  teams: Team[] = [],
): ReactNode {
  if (mode === 'singles') {
    const p = players.find((pl) => pl.id === entityId);
    return p ? <PlayerLabel player={p} showLevel /> : entityId;
  }

  const team = teams.find(
    (t) => t.id === entityId || entityKey(t.playerIds) === entityId,
  );
  if (!team) return entityId;

  return team.playerIds.map((pid, i) => {
    const p = players.find((pl) => pl.id === pid);
    return (
      <Fragment key={pid}>
        {i > 0 && ' / '}
        {p ? <PlayerLabel player={p} compact /> : S.unknown}
      </Fragment>
    );
  });
}
