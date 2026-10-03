export default function Loading() {
  return (
    <div role="status" aria-label="Loading project" className="mx-auto max-w-3xl">
      <div className="skeleton h-4 w-24" />
      <div className="skeleton mt-4 h-8 w-2/3" />
      <div className="skeleton mt-2 h-4 w-1/2" />
      <div className="skeleton mt-6 h-24 w-full" />
      <div className="mt-8 space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="rounded-xl border border-line bg-surface p-5 shadow-card">
            <div className="skeleton h-5 w-1/2" />
            <div className="skeleton mt-2 h-4 w-3/4" />
          </div>
        ))}
      </div>
      <span className="sr-only">Loading…</span>
    </div>
  );
}
