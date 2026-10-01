import { route, parseBody, ApiError } from "@/lib/api";
import { connectDB } from "@/lib/db";
import { User, StudentDataset } from "@/lib/models";
import { registerSchema } from "@/lib/validators";
import { hashPassword, publicUser, startSession } from "@/lib/auth/server";
import { rateLimit, clientIp } from "@/lib/rateLimit";

export const POST = route(async (req) => {
  rateLimit(`register:${clientIp(req)}`, 10, 60 * 60 * 1000);
  const body = await parseBody(req, registerSchema);
  await connectDB();
  if (await User.exists({ email: body.email })) {
    throw new ApiError(409, "An account with this email already exists. Sign in instead.", "email_taken");
  }
  const user = await User.create({ name: body.name, email: body.email, passwordHash: await hashPassword(body.password) });
  const ds = await StudentDataset.create({ owner: user._id, name: "Master student dataset", scope: "profile" });
  user.profileDatasetId = ds._id;
  await user.save();
  await startSession(user);
  return { user: publicUser(user.toObject()) };
});
