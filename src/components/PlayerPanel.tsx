import { useMemo, useRef, useState } from 'react';
import { useStrings } from '../hooks/useStrings';
import {
  DEFAULT_PLAYER_GENDER,
  DEFAULT_PLAYER_LEVEL,
  PLAYER_LEVELS,
  type PlayerGender,
  type PlayerLevel,
  type TournamentCategory,
} from '../types';
import {
  MAX_BULK_PLAYER_COUNT,
  useTournamentStore,
} from '../store/useTournamentStore';
import { CollapsiblePanel } from './CollapsiblePanel';
import {
  defaultGenderForCategory,
  showPlayerGender,
} from '../utils/tournamentCategory';

function listGender(g: PlayerGender): 'male' | 'female' {
  return g === 'female' ? 'female' : 'male';
}

export function PlayerPanel() {
  const S = useStrings();
  const genderOptions = useMemo(
    () => [
      { value: 'male' as const, label: S.genderMaleOption },
      { value: 'female' as const, label: S.genderFemaleOption },
    ],
    [S],
  );
  const [draft, setDraft] = useState('');
  const [draftGender, setDraftGender] = useState<PlayerGender>(DEFAULT_PLAYER_GENDER);
  const [draftLevel, setDraftLevel] = useState<PlayerLevel>(DEFAULT_PLAYER_LEVEL);
  const [addMode, setAddMode] = useState<'single' | 'bulk'>('single');
  const [bulkCount, setBulkCount] = useState('');
  const nameSnapshot = useRef<Map<string, string>>(new Map());
  const tournament = useTournamentStore((s) => s.tournament);
  const hasPlayers = tournament.players.length > 0;
  const setTournamentName = useTournamentStore((s) => s.setTournamentName);
  const setTournamentCategory = useTournamentStore((s) => s.setTournamentCategory);
  const addPlayer = useTournamentStore((s) => s.addPlayer);
  const addPlayersByCount = useTournamentStore((s) => s.addPlayersByCount);
  const clearAllPlayers = useTournamentStore((s) => s.clearAllPlayers);
  const removePlayer = useTournamentStore((s) => s.removePlayer);
  const updatePlayer = useTournamentStore((s) => s.updatePlayer);

  const genderVisible = showPlayerGender(tournament.category);

  const handleCategoryChange = (category: TournamentCategory) => {
    setTournamentCategory(category);
    setDraftGender(defaultGenderForCategory(category));
  };

  const handleAdd = () => {
    const name = draft.trim();
    if (!name) return;
    addPlayer(name, draftGender, draftLevel);
    setDraft('');
    setDraftGender(defaultGenderForCategory(tournament.category));
    setDraftLevel(DEFAULT_PLAYER_LEVEL);
  };

  const handleBulkAdd = () => {
    const n = parseInt(bulkCount, 10);
    if (!Number.isFinite(n) || n < 1) return;
    addPlayersByCount(n, draftGender, draftLevel);
    setBulkCount('');
  };

  const handleBulkReset = () => {
    if (!hasPlayers) return;
    if (!window.confirm(S.confirmClearPlayers)) return;
    clearAllPlayers();
    setBulkCount('');
  };

  const normalizeTournamentName = () => {
    const trimmed = tournament.name.trim();
    if (trimmed !== tournament.name) {
      setTournamentName(trimmed || S.defaultTournamentName);
    } else if (!trimmed) {
      setTournamentName(S.defaultTournamentName);
    }
  };

  return (
    <>
      <CollapsiblePanel
        title={S.panelTournamentInfo}
        titleTitle={S.panelTournamentInfoTitle}
        compact
      >
        <div className="panel-field-row">
          <h2 className="panel-field-label" title={S.tournamentNameTitle}>
            {S.tournamentName}
          </h2>
          <div className="panel-field-control">
            <input
              value={tournament.name}
              onChange={(e) => setTournamentName(e.target.value)}
              onBlur={normalizeTournamentName}
              placeholder={S.tournamentNamePlaceholder}
              title={S.tournamentNameInputTitle}
            />
          </div>
        </div>
        <div className="panel-field-row">
          <h2 className="panel-field-label" title={S.tournamentCategoryTitle}>
            {S.tournamentCategory}
          </h2>
          <div className="panel-field-control">
            <section className="mode-toggle mode-toggle-3" role="group">
              <button
                type="button"
                className={tournament.category === 'men' ? 'active' : ''}
                onClick={() => handleCategoryChange('men')}
                title={S.categoryMenTitle}
              >
                {S.categoryMen}
              </button>
              <button
                type="button"
                className={tournament.category === 'women' ? 'active' : ''}
                onClick={() => handleCategoryChange('women')}
                title={S.categoryWomenTitle}
              >
                {S.categoryWomen}
              </button>
              <button
                type="button"
                className={tournament.category === 'mixed' ? 'active' : ''}
                onClick={() => handleCategoryChange('mixed')}
                title={S.categoryMixedTitle}
              >
                {S.categoryMixed}
              </button>
            </section>
          </div>
        </div>
      </CollapsiblePanel>

      <CollapsiblePanel title={S.addPlayer} titleTitle={S.addPlayerTitle} compact>
        <section
          className="mode-toggle mode-toggle-2 player-add-mode-toggle"
          role="group"
          aria-label={S.addPlayer}
        >
          <button
            type="button"
            className={addMode === 'single' ? 'active' : ''}
            onClick={() => setAddMode('single')}
            title={S.addModeSingleTitle}
          >
            {S.addModeSingle}
          </button>
          <button
            type="button"
            className={addMode === 'bulk' ? 'active' : ''}
            onClick={() => setAddMode('bulk')}
            title={S.addModeBulkTitle}
          >
            {S.addModeBulk}
          </button>
        </section>

        {addMode === 'single' ? (
          <div className="player-form-compact">
            <div className="player-form-col">
              <input
                className="player-form-name-input"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
                placeholder={S.playerNamePlaceholder}
                title={S.playerNameInputTitle}
              />
              {genderVisible && (
                <select
                  className={`player-form-gender-select gender-select-${draftGender}`}
                  value={draftGender}
                  onChange={(e) =>
                    setDraftGender(e.target.value as PlayerGender)
                  }
                  title={S.genderTitle}
                  aria-label={S.gender}
                >
                  {genderOptions.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              )}
              <select
                className="player-form-level-select"
                value={draftLevel}
                onChange={(e) =>
                  setDraftLevel(Number(e.target.value) as PlayerLevel)
                }
                title={S.levelTitle}
                aria-label={S.level}
              >
                {PLAYER_LEVELS.map((lv) => (
                  <option key={lv} value={lv} title={S.levelOptionTitle(lv)}>
                    {S.levelLabel(lv)}
                  </option>
                ))}
              </select>
            </div>
            <button
              type="button"
              className="btn-primary btn-add-player"
              onClick={handleAdd}
              title={S.addButtonTitle}
            >
              {S.addButton}
            </button>
          </div>
        ) : (
          <div className="player-bulk-add">
            <div className="player-form-col player-bulk-options">
              {genderVisible && (
                <select
                  className={`player-form-gender-select gender-select-${draftGender}`}
                  value={draftGender}
                  onChange={(e) =>
                    setDraftGender(e.target.value as PlayerGender)
                  }
                  title={S.genderTitle}
                  aria-label={S.gender}
                >
                  {genderOptions.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              )}
              <select
                className="player-form-level-select"
                value={draftLevel}
                onChange={(e) =>
                  setDraftLevel(Number(e.target.value) as PlayerLevel)
                }
                title={S.levelTitle}
                aria-label={S.level}
              >
                {PLAYER_LEVELS.map((lv) => (
                  <option key={lv} value={lv} title={S.levelOptionTitle(lv)}>
                    {S.levelLabel(lv)}
                  </option>
                ))}
              </select>
            </div>
            <label className="player-bulk-add-label" title={S.bulkAddCountTitle}>
              <span>{S.bulkAddCount}</span>
              <input
                type="number"
                className="player-bulk-count-input"
                min={1}
                max={MAX_BULK_PLAYER_COUNT}
                value={bulkCount}
                onChange={(e) => setBulkCount(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleBulkAdd()}
                placeholder={S.bulkAddCountPlaceholder}
                title={S.bulkAddCountTitle}
                aria-label={S.bulkAddCount}
              />
            </label>
            <div className="player-bulk-actions">
              <button
                type="button"
                className="btn-secondary btn-bulk-add"
                onClick={handleBulkAdd}
                disabled={!bulkCount || parseInt(bulkCount, 10) < 1}
                title={S.bulkAddButtonTitle(MAX_BULK_PLAYER_COUNT)}
              >
                {S.bulkAddButton}
              </button>
              <button
                type="button"
                className="btn-secondary btn-bulk-reset"
                onClick={handleBulkReset}
                disabled={!hasPlayers}
                title={S.bulkAddResetTitle}
              >
                {S.bulkAddReset}
              </button>
            </div>
          </div>
        )}
      </CollapsiblePanel>

      <CollapsiblePanel
        title={S.playerList(tournament.players.length)}
        titleTitle={S.playerListTitle}
      >
        {tournament.players.length === 0 ? (
          <p className="empty-state" title={S.emptyPlayersTitle}>
            <span aria-hidden>{'\u{1F3BE}'}</span>
            <br />
            {S.emptyPlayers}
          </p>
        ) : (
          <ul className="chip-list">
            {tournament.players.map((p, i) => (
              <li key={p.id} className="chip-item chip-item-player">
                <span className="chip-index">{i + 1}.</span>
                <div className="chip-body">
                  <div className="chip-row">
                    <div className="chip-col">
                      <input
                        className="chip-name"
                        value={p.name}
                        onFocus={() => nameSnapshot.current.set(p.id, p.name)}
                        onChange={(e) => updatePlayer(p.id, { name: e.target.value })}
                        onBlur={(e) => {
                          const trimmed = e.target.value.trim();
                          if (!trimmed) {
                            updatePlayer(p.id, {
                              name:
                                nameSnapshot.current.get(p.id) ?? S.unnamedPlayer,
                            });
                          } else if (trimmed !== e.target.value) {
                            updatePlayer(p.id, { name: trimmed });
                          }
                        }}
                        title={S.editPlayerTitle(i + 1)}
                      />
                      {genderVisible && (
                        <select
                          className={`chip-select chip-select-gender gender-select-${listGender(p.gender)}`}
                          value={listGender(p.gender)}
                          onChange={(e) =>
                            updatePlayer(p.id, {
                              gender: e.target.value as 'male' | 'female',
                            })
                          }
                          title={S.editGenderTitle(i + 1)}
                          aria-label={`${p.name} ${S.gender}`}
                        >
                          {genderOptions.map((g) => (
                            <option key={g.value} value={g.value}>
                              {g.label}
                            </option>
                          ))}
                        </select>
                      )}
                      <select
                        className="chip-select chip-select-level"
                        value={p.level}
                        onChange={(e) =>
                          updatePlayer(p.id, {
                            level: Number(e.target.value) as PlayerLevel,
                          })
                        }
                        title={S.editLevelTitle(i + 1)}
                        aria-label={`${p.name} ${S.level}`}
                      >
                        {PLAYER_LEVELS.map((lv) => (
                          <option key={lv} value={lv}>
                            {S.levelLabel(lv)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn-danger"
                  onClick={() => removePlayer(p.id)}
                  aria-label={S.deleteAria(p.name)}
                  title={S.deletePlayer(p.name)}
                >
                  {S.delete}
                </button>
              </li>
            ))}
          </ul>
        )}
      </CollapsiblePanel>
    </>
  );
}
