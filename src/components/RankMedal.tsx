import { useStrings } from '../hooks/useStrings';

/** 最终排名：第 1 名奖杯、第 2 名圆盘，其余显示数字 */
export function RankMedal({ rank }: { rank: number }) {
  const S = useStrings();
  if (rank === 1) {
    return (
      <span className="rank-medal rank-medal-gold" title={S.champion} aria-label={S.champion}>
        <span className="rank-medal-trophy" aria-hidden>
          🏆
        </span>
      </span>
    );
  }
  if (rank === 2) {
    return (
      <span
        className="rank-medal rank-medal-silver"
        title={S.podiumSilver}
        aria-label={S.podiumSilver}
      >
        <span className="rank-medal-plate" aria-hidden />
      </span>
    );
  }
  return <span className="rank-num">{rank}</span>;
}
