import { route, requireUser, escapeRegex } from "@/lib/api";
import { AttendanceSession, MainModule, Student, SubModule, type StudentDoc } from "@/lib/models";
import { serializeSession } from "@/lib/services";

/** Global search: modules, sub modules, students (name / roll) and attendance records. */
export const GET = route(async (req) => {
  const user = await requireUser();
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (!q) return { modules: [], subModules: [], students: [], sessions: [] };
  const rx = { $regex: escapeRegex(q), $options: "i" };
  const rollQ = q.replace(/^0+(?=\d)/, "");

  const [mains, subs] = await Promise.all([
    MainModule.find({ owner: user._id, archivedAt: null }).lean(),
    SubModule.find({ owner: user._id, archivedAt: null }).lean(),
  ]);
  const mainById = new Map(mains.map((m) => [String(m._id), m]));
  const subByDs = new Map(subs.map((s) => [String(s.datasetId), s]));

  const students = await Student.find({
    owner: user._id,
    deletedAt: null,
    $or: [{ name: rx }, { rollNumber: { $regex: `^${escapeRegex(rollQ)}$`, $options: "i" } }],
  })
    .limit(25)
    .lean<StudentDoc[]>();

  const sessions = await AttendanceSession.find(
    { owner: user._id, $or: [{ mainModuleName: rx }, { subModuleName: rx }, { date: { $regex: `^${escapeRegex(q)}` } }] },
    { records: 0 },
  )
    .sort({ date: -1 })
    .limit(10)
    .lean();

  return {
    modules: mains
      .filter((m) => m.name.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 10)
      .map((m) => ({ id: String(m._id), name: m.name, color: m.color })),
    subModules: subs
      .filter((s) => s.name.toLowerCase().includes(q.toLowerCase()))
      .slice(0, 10)
      .map((s) => ({ id: String(s._id), name: s.name, mainModuleName: mainById.get(String(s.mainModuleId))?.name ?? "" })),
    students: students.map((s) => {
      const sub = subByDs.get(String(s.datasetId));
      return {
        id: String(s._id),
        name: s.name,
        rollNumber: s.rollNumber,
        status: s.status,
        subModuleId: sub ? String(sub._id) : null,
        context: sub ? `${mainById.get(String(sub.mainModuleId))?.name ?? ""} · ${sub.name}` : "Master dataset",
      };
    }),
    sessions: sessions.map(serializeSession),
  };
});
