// DEMO ONLY. POST /api/dev/tamper/:entryId
// DECISION: :entryId is the ledger_entries.id INTEGER primary key (globally unique row id),
// not project+idx, so one path param suffices. The public ledger DTO is unchanged; the UI
// obtains row ids server-side.
import { getDb } from "@/lib/db";
import { tamperDisabledError, tamperEnabled } from "@/lib/dev/gate";
import { errorResponse, notFound } from "@/lib/http/errors";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(_req: Request, ctx: { params: Promise<{ entryId: string }> }) {
  try {
    // Server-side gate first; UI hiding is cosmetic only.
    if (!tamperEnabled()) throw tamperDisabledError();
    const { entryId } = await ctx.params;
    if (!/^[1-9]\d*$/.test(entryId)) throw notFound();
    const { tamperEntry } = await import("@/lib/dev/tamper");
    const t = tamperEntry(getDb(), Number(entryId));
    return Response.json(
      {
        tampered: { entryId: t.entryId, projectId: t.projectId, index: t.index },
        message: `Entry #${t.index} payload altered (DEMO). Run Verify integrity to see it break.`,
      },
      { status: 200 },
    );
  } catch (e) {
    return errorResponse(e);
  }
}
