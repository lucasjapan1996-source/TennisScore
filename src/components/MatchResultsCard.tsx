import { useMemo } from 'react';
import { useTournamentStore } from '../store/useTournamentStore';
import { CollapsiblePanel } from './CollapsiblePanel';
import { renderMatchSides } from './PlayerLabel';
import { useStrings } from '../hooks/useStrings';
import { knockoutMatchLabel, resolveMatchSides } from '../utils/knockout';
import { formatSideCompactLabel } from '../utils/player';
import { formatMatchResultsScore, isMatchPlayed } from '../utils/score';
import { isRetired } from '../utils/matchOutcome';
import { groupMatchesBySection, withoutThirdPlaceMatches } from '../utils/schedule';
import { showPlayerGender } from '../utils/tournamentCategory';

import type { Match } from '../types';

function MatchResultsSide({
  side,
  match,
  sideIds,
  players,
  mode,
  teams,
  showGender,
}: {
  side: 'A' | 'B';
  match: Match;
  sideIds: string[];
  players: Parameters<typeof renderMatchSides>[1];
  mode: Parameters<typeof renderMatchSides>[2];
  teams: Parameters<typeof renderMatchSides>[3];
  showGender: boolean;
}) {
  const S = useStrings();
  return (
    <span className="match-results-side">
      {renderMatchSides(sideIds, players, mode, teams, showGender, false)}
      {isRetired(match) && match.retiredSide === side && (
        <span className="match-results-retired-tag" title={S.retirementBannerTitle}>
          （{S.retiredTag}）
        </span>
      )}
    </span>
  );
}

export function MatchResultsCard() {
  const S = useStrings();
  const { tournament } = useTournamentStore();
  const genderVisible = showPlayerGender(tournament.category);
  const compactLabel = (sideIds: string[]) =>
    formatSideCompactLabel(sideIds, tournament.players, genderVisible, false);

  const playedMatches = useMemo(() => {
    const list = withoutThirdPlaceMatches(
      tournament.matches,
      tournament.scheduleFormat,
    ).filter((m) => !m.isBye && isMatchPlayed(m));
    return [...list].sort((a, b) => a.order - b.order);
  }, [tournament.matches, tournament.scheduleFormat]);

  const bySection = useMemo(() => {
    const grouped = groupMatchesBySection(
      playedMatches,
      tournament.scheduleFormat,
    );
    return [...grouped.entries()].sort((a, b) => {
      if (a[0] === 'knockout') return 1;
      if (b[0] === 'knockout') return -1;
      if (a[0] === 'all') return -1;
      if (b[0] === 'all') return 1;
      return Number(a[0].slice(1)) - Number(b[0].slice(1));
    });
  }, [playedMatches, tournament.scheduleFormat]);

  if (playedMatches.length === 0) return null;

  const sectionTitle = (key: string) => {
    if (key === 'knockout') return S.sectionKnockout;
    if (key === 'all') return S.sectionAllMatches;
    return S.groupLabel(Number(key.slice(1)));
  };

  return (
    <CollapsiblePanel
      title={S.matchResultsTitle}
      titleTitle={S.matchResultsTitleHint}
      compact
      defaultOpen
      className="match-results-panel"
    >
      {bySection.map(([key, matches]) => (
        <section key={key} className="match-results-section">
          {tournament.scheduleFormat !== 'round_robin' && (
            <h3 className="match-results-section-title">{sectionTitle(key)}</h3>
          )}
          <ol className="match-results-list">
            {matches.map((m) => {
              const resolved = resolveMatchSides(m, tournament, compactLabel);
              const stageLabel =
                m.knockoutStage != null ? knockoutMatchLabel(m) : null;
              return (
                <li key={m.id} className="match-results-item">
                  <div className="match-results-meta">
                    {tournament.scheduleFormat === 'round_robin' && (
                      <span className="match-order-badge">#{m.order}</span>
                    )}
                    {stageLabel && (
                      <span className="match-order-badge knockout-stage-badge">
                        {stageLabel}
                      </span>
                    )}
                  </div>
                  <div className="match-results-body">
                    <span className="match-results-sides">
                      <MatchResultsSide
                        side="A"
                        match={m}
                        sideIds={m.sideAIds}
                        players={tournament.players}
                        mode={tournament.mode}
                        teams={tournament.teams}
                        showGender={genderVisible}
                      />
                      <span className="match-results-vs">{S.matchupVs}</span>
                      <MatchResultsSide
                        side="B"
                        match={m}
                        sideIds={m.sideBIds}
                        players={tournament.players}
                        mode={tournament.mode}
                        teams={tournament.teams}
                        showGender={genderVisible}
                      />
                    </span>
                    <span className="match-results-score">
                      {formatMatchResultsScore(m)}
                    </span>
                  </div>
                  {!resolved.ready && resolved.waitingReason && (
                    <p className="hint match-results-waiting">
                      {resolved.waitingReason}
                    </p>
                  )}
                </li>
              );
            })}
          </ol>
        </section>
      ))}
    </CollapsiblePanel>
  );
}
