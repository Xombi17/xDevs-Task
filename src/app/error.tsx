"use client";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="mx-auto max-w-md rounded-xl border border-bad/25 bg-bad-soft px-6 py-10 text-center">
      <h1 className="text-lg font-semibold text-bad">Something went wrong</h1>
      <p className="mt-1 text-sm text-slate-600">We could not load this page. Please try again.</p>
      <button type="button" onClick={reset} className="btn btn-primary mt-5">
        Try again
      </button>
    </div>
  );
}
