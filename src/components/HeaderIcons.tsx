export function IconSun() {
  return (
    <svg className="header-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="2" />
      <path
        d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function IconMoon() {
  return (
    <svg className="header-icon" viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M20 14.5A7.5 7.5 0 0 1 9.5 4 6 6 0 1 0 20 14.5Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function IconLangZh() {
  return (
    <svg className="header-icon" viewBox="0 0 24 24" aria-hidden>
      <text
        x="12"
        y="16.5"
        textAnchor="middle"
        fontSize="15"
        fontWeight="700"
        fill="currentColor"
        fontFamily="system-ui, sans-serif"
      >
        中
      </text>
    </svg>
  );
}

export function IconLangJa() {
  return (
    <svg className="header-icon" viewBox="0 0 24 24" aria-hidden>
      <text
        x="12"
        y="16.5"
        textAnchor="middle"
        fontSize="15"
        fontWeight="700"
        fill="currentColor"
        fontFamily="system-ui, sans-serif"
      >
        日
      </text>
    </svg>
  );
}
