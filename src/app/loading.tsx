export default function Loading() {
  return (
    <div role="status" aria-label="Loading">
      <div className="skeleton h-8 w-40" />
      <div className="skeleton mt-2 h-4 w-56" />
      <div className="mt-6 space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-line bg-surface p-5 shadow-card">
            <div className="skeleton h-5 w-2/3" />
            <div className="skeleton mt-2 h-4 w-1/3" />
            <div className="skeleton mt-5 h-1.5 w-full" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
