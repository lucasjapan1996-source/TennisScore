import { Fragment, type ReactNode } from 'react';
import type { MatchMode, Player, Team } from '../types';
import type { PodiumPlace } from '../utils/podium';
import { getActiveStrings } from '../i18n';
import { useStrings } from '../hooks/useStrings';

function entityKey(ids: string[]): string {
  return [...ids].sort().join(',');
}

/** 颁奖台：仅显示姓名，不含等级与性别 */
function renderPodiumNames(
  sideIds: string[],
  players: Player[],
  mode: MatchMode,
  teams: Team[] = [],
): ReactNode {
  const S = getActiveStrings();
  if (sideIds.length === 0) return S.unknown;

  if (mode === 'singles') {
    return players.find((pl) => pl.id === sideIds[0])?.name ?? S.unknown;
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
        {p?.name ?? S.unknown}
      </Fragment>
    );
  });
}

const PODIUM_ORDER: (1 | 2)[] = [2, 1];

function PodiumIcon({
  kind,
  goldTitle,
  silverTitle,
}: {
  kind: 'trophy' | 'plate';
  goldTitle: string;
  silverTitle: string;
}) {
  if (kind === 'trophy') {
    return (
      <span className="podium-icon podium-trophy" aria-hidden title={goldTitle}>
        🏆
      </span>
    );
  }
  return (
    <span
      className="podium-icon podium-plate"
      aria-hidden
      title={silverTitle}
    />
  );
}

export function PodiumDisplay({
  places,
  players,
  teams,
  mode,
}: {
  places: PodiumPlace[];
  players: Player[];
  teams: Team[];
  mode: MatchMode;
}) {
  const S = useStrings();
  const placeMeta = {
    1: { className: 'podium-1', iconKind: 'trophy' as const },
    2: { className: 'podium-2', iconKind: 'plate' as const },
  } as const;
  const byPlace = new Map(places.map((p) => [p.place, p]));

  return (
    <div className="podium-wrap" aria-label={S.podiumTitle}>
      <div className="podium podium-dual">
        {PODIUM_ORDER.map((place) => {
          const entry = byPlace.get(place);
          const meta = placeMeta[place];
          const ready = entry?.ready && entry.sideIds && entry.sideIds.length > 0;

          return (
            <article
              key={place}
              className={`podium-place ${meta.className}${ready ? ' ready' : ''}`}
            >
              <div className="podium-pedestal">
                <div className="podium-name-slot">
                  {ready && entry?.sideIds ? (
                    <span className="podium-name">
                      {renderPodiumNames(
                        entry.sideIds,
                        players,
                        mode,
                        teams,
                      )}
                    </span>
                  ) : (
                    <span className="podium-pending">{S.podiumPending}</span>
                  )}
                </div>
                <div className="podium-pedestal-face">
                  <PodiumIcon
                    kind={meta.iconKind}
                    goldTitle={S.podiumGold}
                    silverTitle={S.podiumSilver}
                  />
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
