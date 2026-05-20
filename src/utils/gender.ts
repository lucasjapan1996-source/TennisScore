import type { PlayerGender } from '../types';

export function genderSymbol(g: PlayerGender): string {
  if (g === 'male') return '♂';
  if (g === 'female') return '♀';
  return '·';
}

export function genderClassName(g: PlayerGender): string {
  if (g === 'male') return 'gender-symbol gender-male';
  if (g === 'female') return 'gender-symbol gender-female';
  return 'gender-symbol gender-unspecified';
}