import { route, requireUser, parseBody } from "@/lib/api";
import { User, type UserDoc } from "@/lib/models";
import { profileSchema } from "@/lib/validators";
import { publicUser } from "@/lib/auth/server";

export const GET = route(async () => {
  const user = await requireUser();
  return { user: publicUser(user) };
});

export const PATCH = route(async (req) => {
  const user = await requireUser();
  const body = await parseBody(req, profileSchema);
  const set: Record<string, unknown> = {};
  if (body.name !== undefined) set.name = body.name;
  if (body.subject !== undefined) set.subject = body.subject;
  if (body.teacherId !== undefined) set.teacherId = body.teacherId;
  if (body.photo !== undefined) set.photo = body.photo;
  if (body.preferences?.attendanceView) set["preferences.attendanceView"] = body.preferences.attendanceView;
  if (body.preferences?.lowAttendanceThreshold !== undefined)
    set["preferences.lowAttendanceThreshold"] = body.preferences.lowAttendanceThreshold;
  const updated = await User.findByIdAndUpdate(user._id, { $set: set }, { new: true }).lean<UserDoc>();
  return { user: publicUser(updated!) };
});
