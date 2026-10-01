import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { ZodError, type ZodType } from "zod";
import { Types } from "mongoose";
import { connectDB } from "./db";
import { User, type UserDoc } from "./models";
import { SESSION_COOKIE, verifySession } from "./auth/jwt";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "error",
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export const notFound = (what = "Item") => new ApiError(404, `${what} not found.`, "not_found");

/** Wraps a route handler: consistent JSON errors, no raw internals leaked. */
export function route<C = unknown>(fn: (req: NextRequest, ctx: C) => Promise<Response | unknown>) {
  return async (req: NextRequest, ctx: C) => {
    try {
      const out = await fn(req, ctx);
      if (out instanceof Response) return out;
      return NextResponse.json(out ?? { ok: true });
    } catch (e) {
      if (e instanceof ApiError) {
        return NextResponse.json({ error: e.message, code: e.code, ...e.extra }, { status: e.status });
      }
      if (e instanceof ZodError) {
        const first = e.issues[0];
        return NextResponse.json(
          { error: first?.message ?? "Some fields are invalid.", code: "validation", issues: e.issues },
          { status: 400 },
        );
      }
      // Duplicate key from a unique index
      if (typeof e === "object" && e && (e as { code?: number }).code === 11000) {
        return NextResponse.json({ error: "This item already exists.", code: "duplicate" }, { status: 409 });
      }
      // Log technical details server-side only; never include student data.
      console.error(`[api] ${req.method} ${req.nextUrl.pathname}:`, e instanceof Error ? e.message : e);
      return NextResponse.json(
        { error: "Something went wrong while processing your request. Please try again.", code: "server_error" },
        { status: 500 },
      );
    }
  };
}

export async function getSessionUser(): Promise<UserDoc | null> {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = await verifySession(token);
  if (!session || !Types.ObjectId.isValid(session.sub)) return null;
  await connectDB();
  const user = await User.findById(session.sub).lean<UserDoc>();
  if (!user || (user.sessionVersion ?? 0) !== session.v) return null;
  return user;
}

export async function requireUser(): Promise<UserDoc> {
  const user = await getSessionUser();
  if (!user) throw new ApiError(401, "Please sign in to continue.", "unauthorized");
  return user;
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ApiError(400, "Invalid request body.", "bad_json");
  }
  return schema.parse(json);
}

export function oid(id: string | null | undefined, what = "Item"): Types.ObjectId {
  if (!id || !Types.ObjectId.isValid(id)) throw notFound(what);
  return new Types.ObjectId(id);
}

export function escapeRegex(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
