import type { MatchMode, Player, Team } from '../types';
import type { PodiumPlace } from '../utils/podium';
import { renderMatchSides } from './PlayerLabel';
import { S } from '../strings';

const PLACE_META = {
  1: { className: 'podium-1', label: S.podiumGold, iconKind: 'trophy' as const },
  2: { className: 'podium-2', label: S.podiumSilver, iconKind: 'plate' as const },
} as const;

const PODIUM_ORDER: (1 | 2)[] = [2, 1];

function PodiumIcon({ kind }: { kind: 'trophy' | 'plate' }) {
  if (kind === 'trophy') {
    return (
      <span className="podium-icon podium-trophy" aria-hidden title={S.podiumGold}>
        🏆
      </span>
    );
  }
  return (
    <span
      className="podium-icon podium-plate"
      aria-hidden
      title={S.podiumSilver}
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
  const byPlace = new Map(places.map((p) => [p.place, p]));

  return (
    <section className="podium-wrap" title={S.podiumTitle}>
      <h3 className="podium-heading">{S.podiumTitle}</h3>
      <div className="podium podium-dual">
        {PODIUM_ORDER.map((place) => {
          const entry = byPlace.get(place);
          const meta = PLACE_META[place];
          const ready = entry?.ready && entry.sideIds && entry.sideIds.length > 0;

          return (
            <article
              key={place}
              className={`podium-place ${meta.className}${ready ? ' ready' : ''}`}
            >
              <PodiumIcon kind={meta.iconKind} />
              <span className="podium-rank-label">{meta.label}</span>
              <p className="podium-name">
                {ready && entry?.sideIds ? (
                  renderMatchSides(entry.sideIds, players, mode, teams)
                ) : (
                  <span className="podium-pending">{S.podiumPending}</span>
                )}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}
