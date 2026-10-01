import { NextResponse } from "next/server";
import { z } from "zod";
import { route, parseBody, ApiError } from "@/lib/api";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models";
import { hashPassword, sha256, startSession, sessionCookieOptions } from "@/lib/auth/server";
import { registerSchema } from "@/lib/validators";
import { rateLimit, clientIp } from "@/lib/rateLimit";

const schema = z.object({
  token: z.string().min(20).max(200),
  password: registerSchema.shape.password,
});

export const POST = route(async (req) => {
  rateLimit(`reset:${clientIp(req)}`, 10, 15 * 60 * 1000);

  const { token, password } = await parseBody(req, schema);

  await connectDB();

  const user = await User.findOne({
    resetTokenHash: sha256(token),
    resetTokenExpires: { $gt: new Date() },
  });

  if (!user) {
    throw new ApiError(
      400,
      "This reset link is invalid or has expired. Request a new one.",
      "invalid_token",
    );
  }

  user.passwordHash = await hashPassword(password);
  user.resetTokenHash = null;
  user.resetTokenExpires = null;
  user.sessionVersion = (user.sessionVersion ?? 0) + 1;

  await user.save();

  const tokenValue = await startSession(user);

  const response = NextResponse.json({
    ok: true,
  });

  response.cookies.set("sa_session", tokenValue, sessionCookieOptions());

  return response;
});
