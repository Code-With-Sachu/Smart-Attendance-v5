import { Types } from "mongoose";
import { route, requireUser, parseBody, oid, notFound, ApiError } from "@/lib/api";
import { AttendanceSession, type AttendanceSessionDoc } from "@/lib/models";
import { attendanceEditSchema } from "@/lib/validators";
import { serializeSession } from "@/lib/services";
import { compareRoll } from "@/lib/roll";

type Ctx = { params: Promise<{ id: string }> };

async function load(owner: Types.ObjectId, id: string) {
  const s = await AttendanceSession.findOne({ _id: oid(id, "Attendance record"), owner }).lean<AttendanceSessionDoc>();
  if (!s) throw notFound("Attendance record");
  return s;
}

export const GET = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const s = await load(user._id, id);
  return {
    session: serializeSession(s),
    records: s.records
      .map((r) => ({
        studentId: String(r.studentId),
        rollNumber: r.rollNumberSnapshot,
        name: r.studentNameSnapshot,
        status: r.status as "present" | "absent",
      }))
      .sort((a, b) => compareRoll(a.rollNumber, b.rollNumber)),
  };
});

/** Edit statuses of an existing session. Snapshots (roll/name) never change. */
export const PATCH = route<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const s = await load(user._id, id);
  const { absentStudentIds } = await parseBody(req, attendanceEditSchema);
  const absent = new Set(absentStudentIds);
  const ids = new Set(s.records.map((r) => String(r.studentId)));
  for (const a of absent) if (!ids.has(a)) throw new ApiError(400, "An absent student is not part of this session.", "bad_absent");
  const records = s.records.map((r) => ({
    studentId: r.studentId,
    rollNumberSnapshot: r.rollNumberSnapshot,
    studentNameSnapshot: r.studentNameSnapshot,
    status: (absent.has(String(r.studentId)) ? "absent" : "present") as "absent" | "present",
  }));
  await AttendanceSession.updateOne(
    { _id: s._id, owner: user._id },
    {
      $set: { records, absent: absent.size, present: records.length - absent.size },
      $inc: { editCount: 1 },
    },
  );
  return { ok: true };
});
