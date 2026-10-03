import type { z } from "zod";
import { badJson, validation } from "@/lib/http/errors";

// 400 for unparseable JSON, 422 for JSON that fails the schema.
export async function parseBody<T>(req: Request, schema: z.ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw badJson();
  }
  const result = schema.safeParse(raw);
  if (!result.success) throw validation(result.error);
  return result.data;
}
