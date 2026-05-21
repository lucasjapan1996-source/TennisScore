import type { PlayerGender } from '../types';
import { genderClassName, genderSymbol } from '../utils/gender';

export function GenderSymbol({
  gender,
  title,
  visible = true,
}: {
  gender: PlayerGender;
  title?: string;
  visible?: boolean;
}) {
  if (!visible) return null;
  return (
    <span className={genderClassName(gender)} title={title} aria-hidden>
      {genderSymbol(gender)}
    </span>
  );
}
