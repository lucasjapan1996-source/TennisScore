import type { Locale, Strings } from './types';
import { useLocaleStore } from '../store/useLocaleStore';
import { jaStrings } from './ja';
import { zhStrings } from './zh';

const catalog: Record<Locale, Strings> = {
  zh: zhStrings,
  ja: jaStrings,
};

export type { Locale, Strings };

export function getStrings(locale: Locale): Strings {
  return catalog[locale];
}

/** 非 React 代码（store / utils）读取当前语言文案 */
export function getActiveStrings(): Strings {
  return getStrings(useLocaleStore.getState().locale);
}
