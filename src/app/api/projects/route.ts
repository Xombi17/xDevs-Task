import { getDb } from "@/lib/db";
import { errorResponse } from "@/lib/http/errors";
import { parseBody } from "@/lib/http/parse";
import { createProject, listProjects } from "@/lib/services/projects";
import { createProjectSchema } from "@/lib/services/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return Response.json(listProjects(getDb()));
  } catch (e) {
    return errorResponse(e);
  }
}

export async function POST(req: Request) {
  try {
    const input = await parseBody(req, createProjectSchema);
    return Response.json(createProject(getDb(), input), { status: 201 });
  } catch (e) {
    return errorResponse(e);
  }
}
