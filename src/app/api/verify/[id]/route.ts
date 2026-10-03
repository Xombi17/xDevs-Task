import { getDb } from "@/lib/db";
import { errorResponse } from "@/lib/http/errors";
import { getProject, getVerify } from "@/lib/services/projects";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Public: allow-listed fields only (no review token).
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await ctx.params;
    const db = getDb();
    const p = getProject(db, id);
    const v = await getVerify(db, id);
    return Response.json({ projectId: p.id, title: p.title, clientName: p.clientName, ...v });
  } catch (e) {
    return errorResponse(e);
  }
}
