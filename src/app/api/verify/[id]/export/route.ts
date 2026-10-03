import { getDb } from "@/lib/db";
import { errorResponse } from "@/lib/http/errors";
import { getExport } from "@/lib/services/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public: downloadable chain for scripts/verify-chain.mjs (allow-listed fields only).
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const doc = await getExport(getDb(), id);
    return new Response(JSON.stringify(doc, null, 2), {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Content-Disposition": `attachment; filename="signseal-export-${id}.json"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    return errorResponse(e);
  }
}
