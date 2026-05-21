import { useId, useState, type ReactNode } from 'react';
import { useStrings } from '../hooks/useStrings';

export function CollapsiblePanel({
  title,
  titleTitle,
  compact = false,
  defaultOpen = true,
  className = '',
  children,
}: {
  title: ReactNode;
  titleTitle?: string;
  compact?: boolean;
  defaultOpen?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const S = useStrings();
  const [open, setOpen] = useState(defaultOpen);
  const bodyId = useId();

  return (
    <section
      className={`panel panel-collapsible${compact ? ' panel-compact' : ''}${open ? '' : ' is-collapsed'}${className ? ` ${className}` : ''}`}
    >
      <button
        type="button"
        className="panel-collapse-trigger"
        aria-expanded={open}
        aria-controls={bodyId}
        title={
          open
            ? S.panelCollapseTitle(titleTitle)
            : S.panelExpandTitle(titleTitle)
        }
        onClick={() => setOpen((v) => !v)}
      >
        <h2 className="panel-collapse-title" title={titleTitle}>
          {title}
        </h2>
        <span className="panel-collapse-chevron" aria-hidden />
      </button>
      <div id={bodyId} className="panel-collapse-body">
        <div className="panel-collapse-body-inner">{children}</div>
      </div>
    </section>
  );
}
