import { getDb } from "@/lib/db";
import { errorResponse } from "@/lib/http/errors";
import { getReviewByToken } from "@/lib/services/review";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SECURITY_HEADERS = {
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
  "Cache-Control": "no-store",
};

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    return Response.json(getReviewByToken(getDb(), token), { headers: SECURITY_HEADERS });
  } catch (e) {
    return errorResponse(e);
  }
}
