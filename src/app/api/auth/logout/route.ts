import { NextResponse } from "next/server";
import { route } from "@/lib/api";
import { SESSION_COOKIE } from "@/lib/auth/jwt";

export const POST = route(async () => {
  const response = NextResponse.json({ ok: true });

  response.cookies.delete(SESSION_COOKIE);

  return response;
});
