import { NextResponse } from "next/server";
import { route, parseBody, ApiError } from "@/lib/api";
import { connectDB } from "@/lib/db";
import { User, type UserDoc } from "@/lib/models";
import { loginSchema } from "@/lib/validators";
import { checkPassword, publicUser, startSession, sessionCookieOptions } from "@/lib/auth/server";
import { rateLimit, clientIp } from "@/lib/rateLimit";

export const POST = route(async (req) => {
  const body = await parseBody(req, loginSchema);
  rateLimit(`login:${clientIp(req)}`, 20, 15 * 60 * 1000);
  rateLimit(`login:${body.email}`, 8, 15 * 60 * 1000);

  await connectDB();

  const user = await User.findOne({ email: body.email }).lean<UserDoc>();

  if (!user || !(await checkPassword(body.password, user.passwordHash))) {
    throw new ApiError(401, "Incorrect email or password.", "invalid_credentials");
  }

  const token = await startSession(user);

  const response = NextResponse.json({
    user: publicUser(user),
  });

  response.cookies.set("sa_session", token, sessionCookieOptions());

  return response;
});
