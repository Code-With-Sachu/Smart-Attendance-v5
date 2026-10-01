import { route, parseBody, ApiError } from "@/lib/api";
import { connectDB } from "@/lib/db";
import { User, type UserDoc } from "@/lib/models";
import { loginSchema } from "@/lib/validators";
import { checkPassword, publicUser, startSession } from "@/lib/auth/server";
import { rateLimit, clientIp } from "@/lib/rateLimit";

export const POST = route(async (req) => {
  const body = await parseBody(req, loginSchema);
  rateLimit(`login:${clientIp(req)}`, 20, 15 * 60 * 1000);
  rateLimit(`login:${body.email}`, 8, 15 * 60 * 1000);
  await connectDB();
  const user = await User.findOne({ email: body.email }).lean<UserDoc>();
  // Same message for unknown email and wrong password (no account enumeration)
  if (!user || !(await checkPassword(body.password, user.passwordHash))) {
    throw new ApiError(401, "Incorrect email or password.", "invalid_credentials");
  }
  await startSession(user);
  return { user: publicUser(user) };
});
