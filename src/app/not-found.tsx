import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md py-10 text-center">
      <p className="font-mono text-sm font-semibold text-accent">404</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">Page not found</h1>
      <p className="mt-1 text-sm text-muted">That page does not exist, or the link is no longer valid.</p>
      <Link href="/" className="btn btn-secondary mt-6">
        Back to projects
      </Link>
    </div>
  );
}
