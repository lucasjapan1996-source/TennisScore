import { useStrings } from '../hooks/useStrings';

export function ScheduleMatchStatusSwitch({
  played,
  disabled = false,
  disabledHint,
  onChange,
}: {
  played: boolean;
  disabled?: boolean;
  disabledHint?: string;
  onChange: (played: boolean) => void;
}) {
  const S = useStrings();
  const title = disabled
    ? (disabledHint ?? S.matchStatusSwitchDisabled)
    : played
      ? S.matchStatusSwitchDoneTitle
      : S.matchStatusSwitchPendingTitle;

  return (
    <label
      className={`schedule-status-switch${played ? ' is-played' : ''}${disabled ? ' is-disabled' : ''}`}
      title={title}
    >
      <input
        type="checkbox"
        className="schedule-status-switch-input"
        checked={played}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={played ? S.matchStatusDone : S.matchStatusPending}
      />
      <span className="schedule-status-switch-track" aria-hidden>
        <span className="schedule-status-switch-thumb" />
      </span>
      <span className="schedule-status-switch-text">
        {played ? S.matchStatusDone : S.matchStatusPending}
      </span>
    </label>
  );
}
