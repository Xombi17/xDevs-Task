export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center rounded-xl border-2 border-dashed border-line bg-surface/70 px-6 py-12 text-center">
      <svg aria-hidden="true" viewBox="0 0 48 48" className="size-12 text-accent/70" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="9" y="6" width="30" height="36" rx="4" />
        <path d="M16 16h16M16 23h16" />
        <circle cx="31" cy="34" r="4" />
        <path d="m29.4 34 1.1 1.1 2-2.2" />
      </svg>
      <h2 className="mt-4 text-base font-semibold text-ink">{title}</h2>
      {description && <p className="mt-1 max-w-sm text-sm text-muted">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
