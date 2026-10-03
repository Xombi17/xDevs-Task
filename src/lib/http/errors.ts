// One error shape for the whole API: { error: { code, message, details? } }.
import type { ZodError } from "zod";
import { LedgerError } from "@/lib/ledger/append";

export class AppError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: unknown,
    public headers?: Record<string, string>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

// Unknown token, unknown project and foreign milestone all look identical (REVW-04).
export const notFound = () => new AppError(404, "NOT_FOUND", "Not found");
export const conflict = (msg: string) => new AppError(409, "ALREADY_DECIDED", msg);
export const badJson = () => new AppError(400, "MALFORMED_JSON", "Request body is not valid JSON");
export const rateLimited = (retryAfterSec: number) =>
  new AppError(429, "RATE_LIMITED", "Too many requests", { retryAfterSec }, {
    "Retry-After": String(retryAfterSec),
  });
export const validation = (err: ZodError) =>
  new AppError(
    422,
    "VALIDATION_ERROR",
    "Validation failed",
    err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
  );

// LedgerError -> AppError, shared by services and errorResponse.
export function fromLedgerError(e: LedgerError): AppError {
  switch (e.code) {
    case "ALREADY_DECIDED":
      return conflict("Milestone already decided");
    case "MILESTONE_NOT_FOUND":
    case "PROJECT_NOT_FOUND":
      return notFound();
    case "INVALID_ACTOR":
      return new AppError(422, "INVALID_ACTOR", e.message);
  }
}

export function errorResponse(e: unknown): Response {
  const err = e instanceof AppError ? e : e instanceof LedgerError ? fromLedgerError(e) : null;
  if (!err) {
    console.error(e);
    return Response.json({ error: { code: "INTERNAL", message: "Internal server error" } }, { status: 500 });
  }
  const error: { code: string; message: string; details?: unknown } = { code: err.code, message: err.message };
  if (err.details !== undefined) error.details = err.details;
  return Response.json({ error }, { status: err.status, headers: err.headers });
}
