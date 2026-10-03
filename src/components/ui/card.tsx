export function Card({ className = "", children }: { className?: string; children: React.ReactNode }) {
  return (
    <div className={`rounded-xl border border-line bg-surface p-4 shadow-card sm:p-5 ${className}`}>{children}</div>
  );
}
