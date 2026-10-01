import "server-only";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import type { UserDoc } from "../models";
import { signSession, SESSION_MAX_AGE } from "./jwt";

export async function hashPassword(pw: string) {
  return bcrypt.hash(pw, 12);
}

export async function checkPassword(pw: string, hash: string) {
  return bcrypt.compare(pw, hash);
}

export async function startSession(user: Pick<UserDoc, "_id" | "sessionVersion">) {
  return signSession({
    sub: String(user._id),
    v: user.sessionVersion ?? 0,
  });
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_MAX_AGE,
  };
}

export function newResetToken() {
  const token = crypto.randomBytes(32).toString("base64url");
  return { token, hash: sha256(token) };
}

export function sha256(s: string) {
  return crypto.createHash("sha256").update(s).digest("hex");
}

export function publicUser(u: UserDoc) {
  return {
    id: String(u._id),
    name: u.name,
    email: u.email,
    subject: u.subject ?? "",
    teacherId: u.teacherId ?? "",
    photo: u.photo ?? "",
    preferences: {
      attendanceView: u.preferences?.attendanceView ?? "detailed",
      lowAttendanceThreshold: u.preferences?.lowAttendanceThreshold ?? 75,
    },
  };
}

export type PublicUser = ReturnType<typeof publicUser>;
