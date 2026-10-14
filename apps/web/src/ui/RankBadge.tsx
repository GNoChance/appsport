import type { Rank } from './art/art-types';
import { RankStone } from './art/RankStone';
import styles from './art.module.css';
import { useArtId } from './use-art-id';

/**
 * Rang en pierre runique (spec refonte §9), lu « Rang E ». `mini` : la version dessinée pour 24–32 px.
 * `locked` : rang pas encore atteint, toujours visible et nommé, mais atténué.
 */
export function RankBadge({
  rank,
  size,
  mini = false,
  locked = false,
}: {
  rank: Rank;
  size: number;
  mini?: boolean;
  locked?: boolean;
}) {
  const idPrefix = useArtId(`rank-${rank}`);
  return (
    <RankStone
      rank={rank}
      mini={mini}
      idPrefix={idPrefix}
      role="img"
      aria-label={`Rang ${rank}`}
      width={size}
      height={size}
      className={[styles.art, locked ? styles.locked : null].filter(Boolean).join(' ')}
      data-locked={locked}
    />
  );
}
