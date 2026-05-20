import { useRef, useState } from 'react';
import {
  DEFAULT_PLAYER_GENDER,
  DEFAULT_PLAYER_LEVEL,
  PLAYER_LEVELS,
  type PlayerGender,
  type PlayerLevel,
} from '../types';
import { useTournamentStore } from '../store/useTournamentStore';
import { S } from '../strings';

const GENDER_OPTIONS: { value: 'male' | 'female'; label: string }[] = [
  { value: 'male', label: S.genderMaleOption },
  { value: 'female', label: S.genderFemaleOption },
];

function listGender(g: PlayerGender): 'male' | 'female' {
  return g === 'female' ? 'female' : 'male';
}

export function PlayerPanel() {
  const [draft, setDraft] = useState('');
  const [draftGender, setDraftGender] = useState<PlayerGender>(DEFAULT_PLAYER_GENDER);
  const [draftLevel, setDraftLevel] = useState<PlayerLevel>(DEFAULT_PLAYER_LEVEL);
  const nameSnapshot = useRef<Map<string, string>>(new Map());
  const tournament = useTournamentStore((s) => s.tournament);
  const setTournamentName = useTournamentStore((s) => s.setTournamentName);
  const addPlayer = useTournamentStore((s) => s.addPlayer);
  const removePlayer = useTournamentStore((s) => s.removePlayer);
  const updatePlayer = useTournamentStore((s) => s.updatePlayer);

  const handleAdd = () => {
    const name = draft.trim();
    if (!name) return;
    addPlayer(name, draftGender, draftLevel);
    setDraft('');
    setDraftGender(DEFAULT_PLAYER_GENDER);
    setDraftLevel(DEFAULT_PLAYER_LEVEL);
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
      <section className="panel">
        <h2 title={S.tournamentNameTitle}>{S.tournamentName}</h2>
        <input
          value={tournament.name}
          onChange={(e) => setTournamentName(e.target.value)}
          onBlur={normalizeTournamentName}
          placeholder={S.tournamentNamePlaceholder}
          title={S.tournamentNameInputTitle}
        />
      </section>

      <section className="panel">
        <h2 title={S.addPlayerTitle}>{S.addPlayer}</h2>
        <p className="hint" title={S.addPlayerHintTitle}>
          {S.addPlayerHint}
        </p>
        <p className="row player-form-name">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            placeholder={S.playerNamePlaceholder}
            title={S.playerNameInputTitle}
          />
        </p>
        <p className="row player-form-meta">
          <label className="field-label">
            <span title={S.genderTitle}>{S.gender}</span>
            <select
              className={`gender-select-${draftGender}`}
              value={draftGender}
              onChange={(e) => setDraftGender(e.target.value as PlayerGender)}
              title={S.genderTitle}
            >
              {GENDER_OPTIONS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            <span title={S.levelTitle}>{S.level}</span>
            <select
              value={draftLevel}
              onChange={(e) =>
                setDraftLevel(Number(e.target.value) as PlayerLevel)
              }
              title={S.levelTitle}
            >
              {PLAYER_LEVELS.map((lv) => (
                <option key={lv} value={lv} title={S.levelOptionTitle(lv)}>
                  {S.levelLabel(lv)}
                </option>
              ))}
            </select>
          </label>
        </p>
        <p className="btn-row">
          <button
            type="button"
            className="btn-primary btn-block"
            onClick={handleAdd}
            title={S.addButtonTitle}
          >
            {S.addButton}
          </button>
        </p>
      </section>

      <section className="panel">
        <h2 title={S.playerListTitle}>{S.playerList(tournament.players.length)}</h2>
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
                  <p className="chip-meta row">
                    <label className="chip-field">
                      <span className="chip-field-label">{S.gender}</span>
                      <select
                        className={`chip-select gender-select-${listGender(p.gender)}`}
                        value={listGender(p.gender)}
                        onChange={(e) =>
                          updatePlayer(p.id, {
                            gender: e.target.value as 'male' | 'female',
                          })
                        }
                        title={S.editGenderTitle(i + 1)}
                        aria-label={`${p.name} ${S.gender}`}
                      >
                        {GENDER_OPTIONS.map((g) => (
                          <option key={g.value} value={g.value}>
                            {g.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="chip-field">
                      <span className="chip-field-label">{S.level}</span>
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
                    </label>
                  </p>
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
      </section>
    </>
  );
}
