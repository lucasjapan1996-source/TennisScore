import type { PlayerGender } from '../types';
import { genderClassName, genderSymbol } from '../utils/gender';

export function GenderSymbol({
  gender,
  title,
}: {
  gender: PlayerGender;
  title?: string;
}) {
  return (
    <span className={genderClassName(gender)} title={title} aria-hidden>
      {genderSymbol(gender)}
    </span>
  );
}
