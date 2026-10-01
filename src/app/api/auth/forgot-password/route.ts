import { z } from "zod";
import { route, parseBody } from "@/lib/api";
import { connectDB } from "@/lib/db";
import { User } from "@/lib/models";
import { newResetToken } from "@/lib/auth/server";
import { rateLimit, clientIp } from "@/lib/rateLimit";

const schema = z.object({ email: z.string().trim().toLowerCase().email("Enter a valid email address") });

async function sendResetEmail(to: string, link: string) {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (key && from) {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to,
        subject: "Reset your Smart Attendance password",
        text: `Use this link to reset your password (valid for 30 minutes):\n\n${link}\n\nIf you didn't request this, ignore this email.`,
      }),
    });
    return;
  }
  if (process.env.NODE_ENV !== "production") {
    // Development only: no email provider configured.
    console.info(`[dev] Password reset link: ${link}`);
  } else {
    console.error("[auth] Password reset requested but RESEND_API_KEY / EMAIL_FROM are not configured.");
  }
}

export const POST = route(async (req) => {
  rateLimit(`forgot:${clientIp(req)}`, 5, 15 * 60 * 1000);
  const { email } = await parseBody(req, schema);
  await connectDB();
  const user = await User.findOne({ email });
  if (user) {
    const { token, hash } = newResetToken();
    user.resetTokenHash = hash;
    user.resetTokenExpires = new Date(Date.now() + 30 * 60 * 1000);
    await user.save();
    const origin = process.env.APP_URL || req.nextUrl.origin;
    await sendResetEmail(email, `${origin}/reset-password?token=${token}`);
  }
  // Always the same response, whether or not the account exists.
  return { ok: true, message: "If an account exists for that email, a reset link has been sent." };
});
