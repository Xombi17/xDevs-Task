import { getDb } from "@/lib/db";
import { errorResponse } from "@/lib/http/errors";
import { getVerify } from "@/lib/services/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    return Response.json(await getVerify(getDb(), id));
  } catch (e) {
    return errorResponse(e);
  }
}
