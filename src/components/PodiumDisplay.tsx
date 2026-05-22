import type { MatchMode, Player, Team } from '../types';
import type { PodiumPlace } from '../utils/podium';
import { useStrings } from '../hooks/useStrings';
import { renderMatchSides } from './PlayerLabel';

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
  showGender = true,
}: {
  places: PodiumPlace[];
  players: Player[];
  teams: Team[];
  mode: MatchMode;
  showGender?: boolean;
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
                      {renderMatchSides(
                        entry.sideIds,
                        players,
                        mode,
                        teams,
                        showGender,
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
