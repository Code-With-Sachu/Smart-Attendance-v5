import { z } from "zod";
import { Types } from "mongoose";
import { route, requireUser, parseBody, ApiError, oid, notFound } from "@/lib/api";
import { AttendanceSession, Student, type StudentDoc } from "@/lib/models";
import { getDataset, serializeStudent } from "@/lib/services";
import { canonicalRoll, normalizeName, type RollFormat } from "@/lib/roll";
import { percent } from "@/lib/utils";

type Ctx = { params: Promise<{ id: string }> };

async function getStudent(userId: Types.ObjectId, id: string) {
  const s = await Student.findOne({ _id: oid(id, "Student"), owner: userId, deletedAt: null }).lean<StudentDoc>();
  if (!s) throw notFound("Student");
  return s;
}

/** Student profile with attendance stats (history uses the stable student id). */
export const GET = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const s = await getStudent(user._id, id);
  const sessions = await AttendanceSession.find(
    { owner: user._id, "records.studentId": s._id },
    { date: 1, time: 1, subModuleName: 1, mainModuleName: 1, records: { $elemMatch: { studentId: s._id } } },
  )
    .sort({ date: -1 })
    .lean();
  let present = 0;
  let absent = 0;
  const history = sessions.map((x) => {
    const rec = (x.records as { status: string }[])[0];
    if (rec?.status === "present") present++;
    else absent++;
    return {
      sessionId: String(x._id),
      date: x.date,
      time: x.time,
      module: `${x.mainModuleName} · ${x.subModuleName}`,
      status: rec?.status ?? "absent",
    };
  });
  return {
    student: serializeStudent(s),
    stats: { present, absent, percentage: present + absent ? percent(present, present + absent) : null },
    history: history.slice(0, 100),
  };
});

const patchSchema = z.object({
  rollNumber: z.string().trim().min(1).max(32).optional(),
  name: z.string().trim().min(1, "Student name is required").max(120).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  datasetId: z.string().regex(/^[a-f0-9]{24}$/i).optional(), // move to another list
});

export const PATCH = route<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const s = await getStudent(user._id, id);
  const body = await parseBody(req, patchSchema);
  const target = await getDataset(user, body.datasetId ?? String(s.datasetId));
  const set: Record<string, unknown> = {};
  let roll = s.rollNumber;
  if (body.rollNumber !== undefined) {
    const r = canonicalRoll(body.rollNumber, (target.rollFormat ?? "numeric") as RollFormat);
    if (!r.ok) throw new ApiError(400, r.reason, "invalid_roll");
    roll = r.value;
    set.rollNumber = roll;
  }
  if (body.name !== undefined) set.name = normalizeName(body.name);
  if (body.status) set.status = body.status;
  if (body.datasetId) set.datasetId = target._id;
  if (set.rollNumber !== undefined || set.datasetId !== undefined) {
    const clash = await Student.findOne({ datasetId: target._id, rollNumber: roll, deletedAt: null, _id: { $ne: s._id } });
    if (clash) throw new ApiError(409, `Roll number ${roll} is already used by ${clash.name} in that list.`, "duplicate_roll");
  }
  const updated = await Student.findByIdAndUpdate(s._id, { $set: set }, { new: true }).lean<StudentDoc>();
  return { student: serializeStudent(updated!) };
});

/** Soft delete. Past attendance keeps the roll/name snapshot. */
export const DELETE = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const s = await getStudent(user._id, id);
  await Student.updateOne({ _id: s._id }, { $set: { deletedAt: new Date(), status: "inactive" } });
  return { ok: true };
});
