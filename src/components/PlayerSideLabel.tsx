import { Fragment, type ReactNode } from 'react';
import type { Player } from '../types';
import { useStrings } from '../hooks/useStrings';
import { GenderSymbol } from './GenderSymbol';

/** 比分卡片用：姓名 + 带颜色的性别图标 */
export function renderSideCompactLabel(
  sideIds: string[],
  players: Player[],
  showGender = true,
): ReactNode {
  const S = useStrings();
  return (
    <>
      {sideIds.map((id, i) => {
        const p = players.find((pl) => pl.id === id);
        return (
          <Fragment key={id}>
            {i > 0 && '/'}
            {!p ? (
              '?'
            ) : (
              <>
                {p.name}
                <span className="player-meta">
                  {' ('}
                  {showGender && <GenderSymbol gender={p.gender} />}
                  {showGender && ' '}
                  <span className="player-level">{S.levelLabel(p.level)}</span>
                  {')'}
                </span>
              </>
            )}
          </Fragment>
        );
      })}
    </>
  );
}
