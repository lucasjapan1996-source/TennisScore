import type { ReactNode } from 'react';
import { useStrings } from '../hooks/useStrings';
import type { RetiredSide } from '../utils/matchOutcome';

export function MatchRetirementActions({
  labelA,
  labelB,
  textLabelA,
  textLabelB,
  retiredSide,
  onRetire,
  onClearRetirement,
  disabled = false,
}: {
  labelA: ReactNode;
  labelB: ReactNode;
  textLabelA: string;
  textLabelB: string;
  retiredSide: RetiredSide | null;
  onRetire: (side: RetiredSide) => void;
  onClearRetirement: () => void;
  disabled?: boolean;
}) {
  const S = useStrings();
  if (disabled) return null;

  const confirmAndRetire = (side: RetiredSide) => {
    const retired = side === 'A' ? textLabelA : textLabelB;
    const winner = side === 'A' ? textLabelB : textLabelA;
    if (!window.confirm(S.confirmRetirement(retired, winner))) return;
    onRetire(side);
  };

  if (retiredSide) {
    const retired = retiredSide === 'A' ? labelA : labelB;
    const winner = retiredSide === 'A' ? labelB : labelA;
    return (
      <div className="match-retirement">
        <p className="match-retirement-banner" title={S.retirementBannerTitle}>
          <span className="match-retired-name">{retired}</span>
          <span className="match-retired-tag">{S.retiredSuffix}</span>
          <span className="match-retired-sep" aria-hidden>
            {S.retiredBannerSep}
          </span>
          <span className="match-retired-name">{winner}</span>
          <span className="match-retired-win">{S.winnerSuffix}</span>
        </p>
        <button
          type="button"
          className="btn-secondary btn-retirement-cancel"
          onClick={onClearRetirement}
          title={S.cancelRetirementTitle}
        >
          {S.cancelRetirement}
        </button>
      </div>
    );
  }

  return (
    <div className="match-retirement match-retirement-row">
      <span className="match-retirement-setup">{S.retireSetupLabel}</span>
      <div className="match-retirement-btns">
        <button
          type="button"
          className="btn-secondary btn-retire-player"
          onClick={() => confirmAndRetire('A')}
          title={S.retireMarkTitle}
        >
          {labelA}
        </button>
        <button
          type="button"
          className="btn-secondary btn-retire-player"
          onClick={() => confirmAndRetire('B')}
          title={S.retireMarkTitle}
        >
          {labelB}
        </button>
      </div>
    </div>
  );
}
