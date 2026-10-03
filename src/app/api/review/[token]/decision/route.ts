import { getDb } from "@/lib/db";
import { errorResponse, rateLimited } from "@/lib/http/errors";
import { parseBody } from "@/lib/http/parse";
import { decisionLimit, rateLimit } from "@/lib/http/rate-limit";
import { decide } from "@/lib/services/review";
import { decisionSchema } from "@/lib/services/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SECURITY_HEADERS = {
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
  "Cache-Control": "no-store",
};

export async function POST(req: Request, ctx: { params: Promise<{ token: string }> }) {
  try {
    const { token } = await ctx.params;
    // Limit first, before any parsing or DB work. Key is the supplied token string; never logged.
    const rl = rateLimit("decision:" + token, decisionLimit());
    if (!rl.ok) throw rateLimited(rl.retryAfterSec);
    const body = await parseBody(req, decisionSchema);
    return Response.json(decide(getDb(), token, body), { headers: SECURITY_HEADERS });
  } catch (e) {
    return errorResponse(e);
  }
}
