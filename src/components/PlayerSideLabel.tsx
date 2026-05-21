import { Fragment, type ReactNode } from 'react';
import type { Player } from '../types';
import { GenderSymbol } from './GenderSymbol';

/** 比分卡片用：姓名 + 带颜色的性别图标 */
export function renderSideCompactLabel(
  sideIds: string[],
  players: Player[],
  showGender = true,
): ReactNode {
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
                {showGender && (
                  <>
                    {' '}
                    <GenderSymbol gender={p.gender} />
                  </>
                )}
              </>
            )}
          </Fragment>
        );
      })}
    </>
  );
}
