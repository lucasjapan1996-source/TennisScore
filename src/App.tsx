import { useMobileScrollFix } from './hooks/useMobileScrollFix';
import { useStrings } from './hooks/useStrings';
import { PlayerPanel } from './components/PlayerPanel';
import { SetupPanel } from './components/SetupPanel';
import { MatchPanel } from './components/MatchPanel';
import { RankingPanel } from './components/RankingPanel';
import { AppLogo } from './components/AppLogo';
import { LanguageSwitcher } from './components/LanguageSwitcher';
import { ThemeSwitcher } from './components/ThemeSwitcher';
import { useTournamentStore } from './store/useTournamentStore';
import { CollapsiblePanel } from './components/CollapsiblePanel';
import type { TabId } from './types';

export default function App() {
  useMobileScrollFix();
  const S = useStrings();

  const activeTab = useTournamentStore((s) => s.activeTab);
  const setActiveTab = useTournamentStore((s) => s.setActiveTab);
  const resetTournament = useTournamentStore((s) => s.resetTournament);
  const tournamentName = useTournamentStore((s) => s.tournament.name);
  const tournamentDescription = useTournamentStore((s) => s.tournament.description);
  const setTournamentDescription = useTournamentStore((s) => s.setTournamentDescription);

  const displayName = tournamentName || S.defaultTournamentName;

  const tabs: { id: TabId; label: string; icon: string; title: string }[] = [
    { id: 'players', label: S.tabPlayers, icon: '👤', title: S.tabPlayersTitle },
    { id: 'setup', label: S.tabSetup, icon: '📅', title: S.tabSetupTitle },
    { id: 'matches', label: S.tabMatches, icon: '✏️', title: S.tabMatchesTitle },
    { id: 'rankings', label: S.tabRankings, icon: '🏆', title: S.tabRankingsTitle },
  ];

  return (
    <div className="app-shell">
      <header className="app-header" title={S.appTitle}>
        <div className="app-header-inner">
          <AppLogo size={30} />
          <h1 className="app-header-title" title={displayName}>
            {displayName}
          </h1>
          <div className="header-controls">
            <ThemeSwitcher />
            <LanguageSwitcher />
          </div>
        </div>
      </header>

      <main className="app-main">
        {activeTab === 'players' && <PlayerPanel />}
        {activeTab === 'setup' && <SetupPanel />}
        {activeTab === 'matches' && <MatchPanel />}
        {activeTab === 'rankings' && <RankingPanel />}

        {activeTab === 'players' && (
          <>
            <CollapsiblePanel
              title={S.tournamentDescription}
              titleTitle={S.tournamentDescriptionTitle}
              compact
            >
              <textarea
                className="tournament-description-input"
                value={tournamentDescription}
                onChange={(e) => setTournamentDescription(e.target.value)}
                placeholder={S.tournamentDescriptionPlaceholder}
                title={S.tournamentDescriptionTitle}
                rows={3}
              />
            </CollapsiblePanel>
            <CollapsiblePanel
              title={S.dataMgmt}
              titleTitle={S.dataMgmtTitle}
              compact
            >
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
            </CollapsiblePanel>
          </>
        )}
      </main>

      <div className="app-bottom-chrome">
        <footer className="app-footer" title={S.copyrightLine}>
          <p>{S.copyrightLine}</p>
        </footer>

        <nav className="tab-bar" aria-label="Main navigation">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={activeTab === tab.id ? 'active' : ''}
              title={tab.title}
              onClick={() => setActiveTab(tab.id)}
            >
              <span className="icon">{tab.icon}</span>
              <span className="tab-label">{tab.label}</span>
            </button>
          ))}
        </nav>
      </div>
    </div>
  );
}
