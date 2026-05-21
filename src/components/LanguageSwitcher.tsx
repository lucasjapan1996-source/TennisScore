import type { ReactElement } from 'react';
import { useStrings } from '../hooks/useStrings';
import { IconLangJa, IconLangZh } from './HeaderIcons';
import { useLocaleStore } from '../store/useLocaleStore';
import type { Locale } from '../i18n';

const LOCALE_ICONS: Record<Locale, () => ReactElement> = {
  zh: IconLangZh,
  ja: IconLangJa,
};

export function LanguageSwitcher() {
  const S = useStrings();
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);

  const options: { id: Locale; label: string }[] = [
    { id: 'zh', label: S.languageZh },
    { id: 'ja', label: S.languageJa },
  ];

  return (
    <div
      className="header-switch lang-switch"
      role="group"
      aria-label={S.language}
    >
      {options.map((opt) => {
        const Icon = LOCALE_ICONS[opt.id];
        return (
          <button
            key={opt.id}
            type="button"
            className={locale === opt.id ? 'active' : ''}
            aria-pressed={locale === opt.id}
            aria-label={opt.label}
            title={opt.label}
            onClick={() => setLocale(opt.id)}
          >
            <Icon />
          </button>
        );
      })}
    </div>
  );
}
