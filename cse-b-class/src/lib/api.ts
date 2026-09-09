import { z } from 'zod';

/** Typed application error with safe public message (§43: never leak stack traces). */
export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
  static badRequest(msg = 'Invalid request') { return new ApiError(400, 'BAD_REQUEST', msg); }
  static unauthorized(msg = 'Please sign in to continue') { return new ApiError(401, 'UNAUTHORIZED', msg); }
  static forbidden(msg = 'You do not have permission to perform this action') { return new ApiError(403, 'FORBIDDEN', msg); }
  static notFound(msg = 'Not found') { return new ApiError(404, 'NOT_FOUND', msg); }
  static conflict(msg = 'This already exists') { return new ApiError(409, 'CONFLICT', msg); }
  static tooMany(msg = 'Too many requests. Please try again later.') { return new ApiError(429, 'RATE_LIMITED', msg); }
  static payload(msg = 'Request payload too large') { return new ApiError(413, 'PAYLOAD_TOO_LARGE', msg); }
}

export function zodMessage(err: z.ZodError): string {
  const first = err.issues[0];
  return first ? `${first.path.join('.') || 'input'}: ${first.message}` : 'Invalid input';
}

export function json(data: unknown, status = 200, headers?: Record<string, string>) {
  return Response.json(data as Record<string, unknown>, { status, headers });
}

export function errorResponse(err: unknown) {
  if (err instanceof ApiError) {
    return Response.json({ error: { code: err.code, message: err.message } }, { status: err.status });
  }
  if (err instanceof z.ZodError) {
    return Response.json({ error: { code: 'VALIDATION', message: zodMessage(err) } }, { status: 400 });
  }
  console.error('[api] unhandled error:', err);
  // Never leak internals (§35/§43)
  return Response.json(
    { error: { code: 'INTERNAL', message: 'Something went wrong. Please try again.' } },
    { status: 500 },
  );
}

export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    return errorResponse(err);
  }
}

export async function body<T extends z.ZodTypeAny>(req: Request, schema: T): Promise<z.infer<T>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw ApiError.badRequest('Request body must be valid JSON');
  }
  return schema.parse(raw);
}
