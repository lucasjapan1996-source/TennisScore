import { useEffect } from 'react';
import { getStrings } from '../i18n';
import { useLocaleStore } from '../store/useLocaleStore';

export function useStrings() {
  const locale = useLocaleStore((s) => s.locale);

  useEffect(() => {
    document.documentElement.lang = locale === 'ja' ? 'ja' : 'zh-CN';
    document.title = getStrings(locale).appTitle;
  }, [locale]);

  return getStrings(locale);
}
