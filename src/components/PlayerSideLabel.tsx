import { Fragment, type ReactNode } from 'react';
import type { Player } from '../types';
import { useStrings } from '../hooks/useStrings';
import { GenderSymbol } from './GenderSymbol';

/** 比分卡片用：姓名 + 带颜色的性别图标（独立组件，避免在父级 render 中条件调用 hooks） */
export function SideCompactLabel({
  sideIds,
  players,
  showGender = true,
}: {
  sideIds: string[];
  players: Player[];
  showGender?: boolean;
}) {
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

/** @deprecated 请使用 `<SideCompactLabel />` */
export function renderSideCompactLabel(
  sideIds: string[],
  players: Player[],
  showGender = true,
): ReactNode {
  return (
    <SideCompactLabel
      sideIds={sideIds}
      players={players}
      showGender={showGender}
    />
  );
}
