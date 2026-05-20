import { PlayerPanel } from './components/PlayerPanel';
import { SetupPanel } from './components/SetupPanel';
import { MatchPanel } from './components/MatchPanel';
import { RankingPanel } from './components/RankingPanel';
import { useTournamentStore } from './store/useTournamentStore';
import { S } from './strings';
import type { TabId } from './types';

const TABS: { id: TabId; label: string; icon: string; title: string }[] = [
  { id: 'players', label: S.tabPlayers, icon: '👤', title: S.tabPlayersTitle },
  { id: 'setup', label: S.tabSetup, icon: '📅', title: S.tabSetupTitle },
  { id: 'matches', label: S.tabMatches, icon: '✏️', title: S.tabMatchesTitle },
  { id: 'rankings', label: S.tabRankings, icon: '🏆', title: S.tabRankingsTitle },
];

export default function App() {
  const activeTab = useTournamentStore((s) => s.activeTab);
  const setActiveTab = useTournamentStore((s) => s.setActiveTab);
  const resetTournament = useTournamentStore((s) => s.resetTournament);
  const tournamentName = useTournamentStore((s) => s.tournament.name);

  const displayName = tournamentName || S.defaultTournamentName;

  return (
    <>
      <header className="app-header" title={S.appTitle}>
        <h1 title={displayName}>🎾 {displayName}</h1>
      </header>

      <main className="app-main">
        {activeTab === 'players' && <PlayerPanel />}
        {activeTab === 'setup' && <SetupPanel />}
        {activeTab === 'matches' && <MatchPanel />}
        {activeTab === 'rankings' && <RankingPanel />}

        {activeTab === 'players' && (
          <section className="panel">
            <h2 title={S.dataMgmtTitle}>{S.dataMgmt}</h2>
            <p className="hint" title={S.dataHintTitle}>
              {S.dataHint}
            </p>
            <p className="btn-row">
              <button
                type="button"
                className="btn-secondary"
                title={S.newTournamentTitle}
                onClick={() => {
                  if (window.confirm(S.confirmReset)) {
                    resetTournament();
                  }
                }}
              >
                {S.newTournament}
              </button>
            </p>
          </section>
        )}
      </main>

      <nav className="tab-bar" aria-label="Main navigation">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={activeTab === tab.id ? 'active' : ''}
            title={tab.title}
            onClick={() => setActiveTab(tab.id)}
          >
            <span className="icon">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </nav>
    </>
  );
}
