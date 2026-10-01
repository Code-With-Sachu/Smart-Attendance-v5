import { z } from "zod";
import { Types } from "mongoose";
import { route, requireUser, parseBody, ApiError, escapeRegex } from "@/lib/api";
import { AttendanceSession, StudentDataset, SubModule, type AttendanceSessionDoc } from "@/lib/models";
import {
  getDataset,
  getMainModule,
  getSubModule,
  listStudents,
  serializeDataset,
  serializeSession,
  serializeStudent,
} from "@/lib/services";
import { percent } from "@/lib/utils";

type Ctx = { params: Promise<{ id: string }> };

/** Sub module detail with students and per-student analytics. */
export const GET = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const sub = await getSubModule(user, id);
  const main = await getMainModule(user, String(sub.mainModuleId));
  const ds = await getDataset(user, String(sub.datasetId));
  const students = await listStudents(ds._id, { includeInactive: true });
  const sessions = await AttendanceSession.find({ owner: user._id, subModuleId: sub._id })
    .sort({ date: -1, time: -1 })
    .lean<AttendanceSessionDoc[]>();

  const stats = new Map<string, { present: number; absent: number }>();
  let present = 0;
  let total = 0;
  for (const s of sessions) {
    present += s.present ?? 0;
    total += s.total ?? 0;
    for (const r of s.records) {
      const k = String(r.studentId);
      const st = stats.get(k) ?? { present: 0, absent: 0 };
      if (r.status === "present") st.present++;
      else st.absent++;
      stats.set(k, st);
    }
  }
  const active = students.filter((s) => s.status === "active");
  return {
    subModule: { id: String(sub._id), name: sub.name, code: sub.code ?? "", datasetId: String(sub.datasetId) },
    mainModule: { id: String(main._id), name: main.name, color: main.color, number: main.number },
    dataset: serializeDataset(ds, active.length),
    students: students.map((s) => {
      const st = stats.get(String(s._id)) ?? { present: 0, absent: 0 };
      return {
        ...serializeStudent(s),
        present: st.present,
        absent: st.absent,
        percentage: st.present + st.absent ? percent(st.present, st.present + st.absent) : null,
      };
    }),
    analytics: {
      totalClasses: sessions.length,
      averageAttendance: total ? percent(present, total) : null,
      students: active.length,
      recent: sessions.slice(0, 10).map(serializeSession),
    },
  };
});

const patchSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(80),
  code: z.string().trim().max(20).optional(),
});

export const PATCH = route<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const sub = await getSubModule(user, id);
  const body = await parseBody(req, patchSchema);
  const dup = await SubModule.exists({
    owner: user._id,
    mainModuleId: sub.mainModuleId,
    archivedAt: null,
    _id: { $ne: sub._id },
    name: { $regex: `^${escapeRegex(body.name)}$`, $options: "i" },
  });
  if (dup) throw new ApiError(409, `"${body.name}" already exists in this module.`, "duplicate_name");
  await SubModule.updateOne({ _id: sub._id }, { $set: body });
  await StudentDataset.updateOne({ _id: sub.datasetId as Types.ObjectId }, { $set: { name: body.name } });
  return { ok: true };
});

/** Archive — students and attendance history remain in the database. */
export const DELETE = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const sub = await getSubModule(user, id);
  await SubModule.updateOne({ _id: sub._id }, { $set: { archivedAt: new Date() } });
  return { ok: true };
});
