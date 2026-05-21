import type { ReactNode } from 'react';

export function PanelTitle({
  children,
  hint,
  title,
  hintTitle,
  as = 'h2',
  className = '',
}: {
  children: ReactNode;
  hint?: string;
  title?: string;
  hintTitle?: string;
  as?: 'h2' | 'h3';
  className?: string;
}) {
  const Tag = as;
  return (
    <Tag
      className={`panel-title${className ? ` ${className}` : ''}`}
      title={title}
    >
      <span className="panel-title-text">{children}</span>
      {hint ? (
        <span className="panel-title-hint" title={hintTitle ?? hint}>
          （{hint}）
        </span>
      ) : null}
    </Tag>
  );
}
