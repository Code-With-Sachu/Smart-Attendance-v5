import "server-only";
import { Types, type AnyBulkWriteOperation } from "mongoose";
import { ApiError, notFound, oid } from "./api";
import {
  AttendanceSession,
  FileImport,
  MainModule,
  Student,
  StudentDataset,
  SubModule,
  User,
  type MainModuleDoc,
  type StudentDatasetDoc,
  type StudentDoc,
  type SubModuleDoc,
  type UserDoc,
} from "./models";
import { buildPreview, diffStudents, type IncomingStudent } from "./import/core";
import { compareRoll, type RollFormat } from "./roll";
import { percent } from "./utils";

type Owner = Pick<UserDoc, "_id">;

/* ------------------------------ Serializers ------------------------------ */
export function serializeStudent(s: StudentDoc) {
  return {
    id: String(s._id),
    datasetId: String(s.datasetId),
    rollNumber: s.rollNumber,
    name: s.name,
    status: s.status as "active" | "inactive",
  };
}
export type StudentDTO = ReturnType<typeof serializeStudent>;

export function serializeDataset(d: StudentDatasetDoc, count: number) {
  return {
    id: String(d._id),
    name: d.name,
    scope: d.scope as "submodule" | "profile",
    subModuleId: d.subModuleId ? String(d.subModuleId) : null,
    rollFormat: (d.rollFormat ?? "numeric") as RollFormat,
    lastImportedAt: d.lastImportedAt ? new Date(d.lastImportedAt).toISOString() : null,
    studentCount: count,
  };
}
export type DatasetDTO = ReturnType<typeof serializeDataset>;

/* ------------------------------- Ownership ------------------------------- */
export async function getMainModule(user: Owner, id: string) {
  const m = await MainModule.findOne({ _id: oid(id, "Module"), owner: user._id, archivedAt: null }).lean<MainModuleDoc>();
  if (!m) throw notFound("Module");
  return m;
}

export async function getSubModule(user: Owner, id: string) {
  const s = await SubModule.findOne({ _id: oid(id, "Sub module"), owner: user._id, archivedAt: null }).lean<SubModuleDoc>();
  if (!s) throw notFound("Sub module");
  return s;
}

export async function getDataset(user: Owner, id: string) {
  const d = await StudentDataset.findOne({ _id: oid(id, "Student list"), owner: user._id }).lean<StudentDatasetDoc>();
  if (!d) throw notFound("Student list");
  return d;
}

export async function ensureProfileDataset(user: UserDoc) {
  if (user.profileDatasetId) {
    const d = await StudentDataset.findOne({ _id: user.profileDatasetId, owner: user._id }).lean<StudentDatasetDoc>();
    if (d) return d;
  }
  const d = await StudentDataset.create({ owner: user._id, name: "Master student dataset", scope: "profile" });
  await User.updateOne({ _id: user._id }, { profileDatasetId: d._id });
  return d.toObject() as StudentDatasetDoc;
}

/* -------------------------------- Students ------------------------------- */
export async function listStudents(datasetId: Types.ObjectId, opts: { includeInactive?: boolean } = {}) {
  const q: Record<string, unknown> = { datasetId, deletedAt: null };
  if (!opts.includeInactive) q.status = "active";
  const list = await Student.find(q).lean<StudentDoc[]>();
  return list.sort((a, b) => compareRoll(a.rollNumber, b.rollNumber));
}

export async function countActive(datasetIds: Types.ObjectId[]) {
  if (!datasetIds.length) return new Map<string, number>();
  const rows = await Student.aggregate<{ _id: Types.ObjectId; n: number }>([
    { $match: { datasetId: { $in: datasetIds }, deletedAt: null, status: "active" } },
    { $group: { _id: "$datasetId", n: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.n]));
}

/**
 * Applies a confirmed import. The server re-validates everything the client
 * previewed. Students are matched by roll number; removed students are
 * deactivated (never hard-deleted) so attendance history stays intact.
 */
export async function applyImport(
  user: Owner,
  dataset: StudentDatasetDoc,
  input: {
    students: IncomingStudent[];
    rollFormat: RollFormat;
    removeMissing: boolean;
    fileName: string;
    source: "file" | "google-sheet" | "profile-copy";
    fileKind?: string;
  },
) {
  const preview = buildPreview(
    { headers: ["roll", "name"], rows: input.students.map((s) => [s.rollNumber, s.name]) },
    { roll: 0, name: 1 },
    input.rollFormat,
  );
  if (preview.errors > 0) {
    const first = preview.rows.find((r) => r.status === "error");
    throw new ApiError(
      422,
      first ? `${first.issues[0].message} (roll ${first.rawRoll || "?"}). Fix the file and import again.` : "The data has errors.",
      "invalid_import",
    );
  }
  const incoming = preview.rows.map((r) => ({ rollNumber: r.rollNumber, name: r.name }));
  const existing = (await listStudents(dataset._id, { includeInactive: true })).map((s) => ({
    id: String(s._id),
    rollNumber: s.rollNumber,
    name: s.name,
    status: s.status as "active" | "inactive",
  }));
  const diff = diffStudents(existing, incoming);
  const removed = input.removeMissing ? diff.removed : [];

  const ops: AnyBulkWriteOperation[] = [];
  for (const a of diff.added)
    ops.push({
      insertOne: {
        document: { owner: user._id, datasetId: dataset._id, rollNumber: a.rollNumber, name: a.name, status: "active" } as never,
      },
    });
  for (const u of diff.updated)
    ops.push({ updateOne: { filter: { _id: new Types.ObjectId(u.id), owner: user._id }, update: { $set: { name: u.name, status: "active" } } } });
  for (const r of removed)
    ops.push({ updateOne: { filter: { _id: new Types.ObjectId(r.id), owner: user._id }, update: { $set: { status: "inactive" } } } });
  if (ops.length) await Student.bulkWrite(ops, { ordered: true });

  const now = new Date();
  await StudentDataset.updateOne(
    { _id: dataset._id },
    { $set: { lastImportedAt: now, rollFormat: input.rollFormat } },
  );
  const log = await FileImport.create({
    owner: user._id,
    datasetId: dataset._id,
    fileName: input.fileName,
    source: input.source,
    fileKind: input.fileKind ?? "",
    totalRows: incoming.length,
    added: diff.added.length,
    updated: diff.updated.length,
    removed: removed.length,
    unchanged: diff.unchanged,
    changes: [
      ...diff.added.map((a) => ({ type: "added" as const, rollNumber: a.rollNumber, name: a.name })),
      ...diff.updated.map((u) => ({ type: "updated" as const, rollNumber: u.rollNumber, name: u.name, previousName: u.previousName })),
      ...removed.map((r) => ({ type: "removed" as const, rollNumber: r.rollNumber, name: r.name })),
    ].slice(0, 2000),
  });
  return {
    importId: String(log._id),
    added: diff.added.length,
    updated: diff.updated.length,
    removed: removed.length,
    unchanged: diff.unchanged,
  };
}

/* ------------------------------- Summaries ------------------------------- */
export async function moduleOverview(user: Owner) {
  const [mains, subs] = await Promise.all([
    MainModule.find({ owner: user._id, archivedAt: null }).sort({ number: 1, name: 1 }).lean<MainModuleDoc[]>(),
    SubModule.find({ owner: user._id, archivedAt: null }).sort({ name: 1 }).lean<SubModuleDoc[]>(),
  ]);
  const counts = await countActive(subs.map((s) => s.datasetId as Types.ObjectId));
  // Plain query + JS reduce (portable across MongoDB-compatible backends)
  const sessionRows = await AttendanceSession.find(
    { owner: user._id },
    { subModuleId: 1, date: 1, present: 1, total: 1 },
  ).lean<{ subModuleId: Types.ObjectId; date: string; present?: number; total?: number }[]>();
  const agg = new Map<string, { date: string; sessions: number; present: number; total: number }>();
  for (const r of sessionRows) {
    const k = String(r.subModuleId);
    const a = agg.get(k) ?? { date: "", sessions: 0, present: 0, total: 0 };
    if (r.date > a.date) a.date = r.date;
    a.sessions++;
    a.present += r.present ?? 0;
    a.total += r.total ?? 0;
    agg.set(k, a);
  }
  const lastBySub = agg;

  const subDTO = subs.map((s) => {
    const l = lastBySub.get(String(s._id));
    return {
      id: String(s._id),
      mainModuleId: String(s.mainModuleId),
      name: s.name,
      code: s.code ?? "",
      datasetId: String(s.datasetId),
      studentCount: counts.get(String(s.datasetId)) ?? 0,
      lastAttendance: l?.date ?? null,
      sessions: l?.sessions ?? 0,
      averageAttendance: l ? percent(l.present, l.total) : null,
    };
  });
  const modules = mains.map((m) => {
    const children = subDTO.filter((s) => s.mainModuleId === String(m._id));
    const dates = children.map((c) => c.lastAttendance).filter(Boolean) as string[];
    return {
      id: String(m._id),
      name: m.name,
      number: m.number,
      color: m.color ?? "#6366f1",
      subModules: children,
      subModuleCount: children.length,
      studentCount: Math.max(0, ...children.map((c) => c.studentCount)),
      lastAttendance: dates.sort().at(-1) ?? null,
    };
  });
  return modules;
}
export type ModuleOverview = Awaited<ReturnType<typeof moduleOverview>>[number];
export type SubModuleOverview = ModuleOverview["subModules"][number];

export function serializeSession(s: {
  _id: Types.ObjectId;
  mainModuleId: unknown;
  subModuleId: unknown;
  mainModuleName: string;
  subModuleName: string;
  date: string;
  time: string;
  sessionLabel?: string | null;
  total?: number | null;
  present?: number | null;
  absent?: number | null;
  editCount?: number | null;
  createdAt?: Date;
  updatedAt?: Date;
}) {
  return {
    id: String(s._id),
    mainModuleId: String(s.mainModuleId),
    subModuleId: String(s.subModuleId),
    mainModuleName: s.mainModuleName,
    subModuleName: s.subModuleName,
    date: s.date,
    time: s.time,
    sessionLabel: s.sessionLabel ?? "Session 1",
    total: s.total ?? 0,
    present: s.present ?? 0,
    absent: s.absent ?? 0,
    editCount: s.editCount ?? 0,
    createdAt: s.createdAt ? new Date(s.createdAt).toISOString() : null,
    updatedAt: s.updatedAt ? new Date(s.updatedAt).toISOString() : null,
  };
}
export type SessionDTO = ReturnType<typeof serializeSession>;
