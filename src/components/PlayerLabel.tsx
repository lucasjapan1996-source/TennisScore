import { Fragment, type ReactNode } from 'react';
import type { MatchMode, Player, ScheduleFormat, Team, DoublesPairing } from '../types';
import { usesPlayerStandings } from '../utils/ranking';
import { getActiveStrings } from '../i18n';
import { useStrings } from '../hooks/useStrings';
import { GenderSymbol } from './GenderSymbol';

export function PlayerLabel({
  player,
  showLevel = false,
  compact = false,
  showGender = true,
}: {
  player: Player;
  showLevel?: boolean;
  compact?: boolean;
  showGender?: boolean;
}) {
  const S = useStrings();
  return (
    <span className="player-label">
      {player.name}
      {!compact && showGender && ' '}
      <GenderSymbol gender={player.gender} visible={showGender} />
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
  showGender = true,
): ReactNode {
  const S = getActiveStrings();
  if (sideIds.length === 0) return S.unknown;

  if (mode === 'singles') {
    const p = players.find((pl) => pl.id === sideIds[0]);
    return p ? (
      <PlayerLabel player={p} showLevel showGender={showGender} />
    ) : (
      S.unknown
    );
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
        {p ? (
          <PlayerLabel player={p} compact showGender={showGender} />
        ) : (
          S.unknown
        )}
      </Fragment>
    );
  });
}

export function renderStandingName(
  entityId: string,
  players: Player[],
  mode: MatchMode,
  teams: Team[] = [],
  showGender = true,
  standingContext?: {
    scheduleFormat: ScheduleFormat;
    doublesPairing: DoublesPairing;
  },
): ReactNode {
  const S = getActiveStrings();
  if (
    mode === 'singles' ||
    (standingContext &&
      usesPlayerStandings(mode, standingContext))
  ) {
    const p = players.find((pl) => pl.id === entityId);
    return p ? (
      <PlayerLabel player={p} showLevel showGender={showGender} />
    ) : (
      entityId
    );
  }

  const team = teams.find(
    (t) => t.id === entityId || entityKey(t.playerIds) === entityId,
  );
  if (!team) {
    if (entityId.includes(',')) {
      return entityId.split(',').map((pid, i) => {
        const p = players.find((pl) => pl.id === pid);
        return (
          <Fragment key={pid}>
            {i > 0 && ' / '}
            {p ? (
              <PlayerLabel player={p} compact showGender={showGender} />
            ) : (
              pid
            )}
          </Fragment>
        );
      });
    }
    return entityId;
  }

  return team.playerIds.map((pid, i) => {
    const p = players.find((pl) => pl.id === pid);
    return (
      <Fragment key={pid}>
        {i > 0 && ' / '}
        {p ? (
          <PlayerLabel player={p} compact showGender={showGender} />
        ) : (
          S.unknown
        )}
      </Fragment>
    );
  });
}
