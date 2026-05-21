import type { ReactElement } from 'react';
import { useStrings } from '../hooks/useStrings';
import { IconMoon, IconSun } from './HeaderIcons';
import { useThemeStore, type Theme } from '../store/useThemeStore';

const THEME_ICONS: Record<Theme, () => ReactElement> = {
  light: IconSun,
  dark: IconMoon,
};

export function ThemeSwitcher() {
  const S = useStrings();
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  const options: { id: Theme; label: string }[] = [
    { id: 'light', label: S.themeLight },
    { id: 'dark', label: S.themeDark },
  ];

  return (
    <div
      className="header-switch theme-switch"
      role="group"
      aria-label={S.theme}
    >
      {options.map((opt) => {
        const Icon = THEME_ICONS[opt.id];
        return (
          <button
            key={opt.id}
            type="button"
            className={theme === opt.id ? 'active' : ''}
            aria-pressed={theme === opt.id}
            aria-label={opt.label}
            title={opt.label}
            onClick={() => setTheme(opt.id)}
          >
            <Icon />
          </button>
        );
      })}
    </div>
  );
}
