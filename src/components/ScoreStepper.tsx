export function ScoreStepper({
  value,
  onAdd,
  disabled = false,
  size = 'big',
  addLabel,
}: {
  value: number;
  onAdd: () => void;
  disabled?: boolean;
  size?: 'big' | 'small';
  addLabel: string;
}) {
  if (disabled) {
    return (
      <div
        className={`score-stepper score-stepper--${size} score-stepper--readonly`}
        aria-label={addLabel}
      >
        <span className="score-stepper-value">{value}</span>
      </div>
    );
  }

  return (
    <button
      type="button"
      className={`score-stepper score-stepper--${size}`}
      onClick={onAdd}
      aria-label={addLabel}
    >
      <span className="score-stepper-value">{value}</span>
    </button>
  );
}
