import { getDb } from "@/lib/db";
import { errorResponse } from "@/lib/http/errors";
import { getLedger } from "@/lib/services/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    return Response.json(await getLedger(getDb(), id));
  } catch (e) {
    return errorResponse(e);
  }
}
