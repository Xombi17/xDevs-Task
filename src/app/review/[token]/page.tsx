import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { AppError } from "@/lib/http/errors";
import { getReviewByToken } from "@/lib/services/review";
import { ReviewPanel } from "./review-panel";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Generic title on purpose: the token must never reach titles, history or referrers.
export function generateMetadata(): Metadata {
  return {
    title: "Review milestones",
    robots: { index: false, follow: false },
    referrer: "no-referrer",
  };
}

function load(token: string) {
  try {
    return getReviewByToken(getDb(), token);
  } catch (e) {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  }
}

export default async function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const review = load(token);
  const milestones = [...review.milestones].sort((a, b) => a.position - b.position);

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="break-words text-2xl font-bold tracking-tight sm:text-3xl">{review.projectTitle}</h1>
      <p className="mt-1 text-sm text-muted">Prepared for {review.clientName}</p>
      <p className="mt-4 text-sm text-slate-600">
        Enter your name, then approve each milestone or request changes. Decisions are final and recorded in a
        tamper-evident log.
      </p>
      <ReviewPanel milestones={milestones} />
    </div>
  );
}
