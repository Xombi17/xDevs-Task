import Link from "next/link";

export default function VerifyNotFound() {
  return (
    <div className="mx-auto max-w-md py-10 text-center">
      <p className="font-mono text-sm font-semibold text-accent">404</p>
      <h1 className="mt-2 text-2xl font-bold tracking-tight">Audit trail not found</h1>
      <p className="mt-1 text-sm text-muted">Check the address and try again.</p>
      <Link href="/" className="btn btn-secondary mt-6">
        Go to SignSeal
      </Link>
    </div>
  );
}
