export default function Loading() {
  return (
    <div role="status" aria-label="Loading audit trail" className="mx-auto max-w-3xl">
      <div className="skeleton h-4 w-32" />
      <div className="skeleton mt-4 h-8 w-48" />
      <div className="skeleton mt-6 h-32 w-full" />
      <div className="mt-8 space-y-4 border-l-2 border-line pl-5">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-line bg-surface p-5 shadow-card">
            <div className="skeleton h-4 w-1/2" />
            <div className="skeleton mt-3 h-3 w-2/3" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
