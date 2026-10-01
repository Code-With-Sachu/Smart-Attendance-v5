// Edge-safe (used by middleware) — no Node-only imports here.
import { SignJWT, jwtVerify } from "jose";

export const SESSION_COOKIE = "sa_session";
export const SESSION_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

function secret() {
  const s = process.env.AUTH_SECRET;
  if (!s || s.length < 32) throw new Error("AUTH_SECRET must be set to at least 32 characters");
  return new TextEncoder().encode(s);
}

export type SessionPayload = { sub: string; v: number };

export async function signSession(payload: SessionPayload) {
  return new SignJWT({ v: payload.v })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE}s`)
    .sign(secret());
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret(), { algorithms: ["HS256"] });
    if (!payload.sub) return null;
    return { sub: payload.sub, v: Number(payload.v ?? 0) };
  } catch {
    return null;
  }
}
