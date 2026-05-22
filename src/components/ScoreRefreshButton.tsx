export function ScoreRefreshButton({
  onClick,
  title,
  ariaLabel,
  disabled = false,
}: {
  onClick: () => void;
  title: string;
  ariaLabel: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      className="btn-icon btn-score-refresh"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      disabled={disabled}
    >
      <svg
        aria-hidden
        viewBox="0 0 24 24"
        width="18"
        height="18"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M21 12a9 9 0 1 1-2.64-6.36" />
        <path d="M21 3v6h-6" />
      </svg>
    </button>
  );
}
