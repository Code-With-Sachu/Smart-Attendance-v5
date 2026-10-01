import { route, requireUser, parseBody, ApiError } from "@/lib/api";
import { Student } from "@/lib/models";
import { studentSchema } from "@/lib/validators";
import { getDataset, listStudents, serializeDataset, serializeStudent } from "@/lib/services";
import { canonicalRoll, normalizeName, type RollFormat } from "@/lib/roll";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const ds = await getDataset(user, id);
  const includeInactive = req.nextUrl.searchParams.get("includeInactive") === "1";
  const students = await listStudents(ds._id, { includeInactive });
  const activeCount = includeInactive ? students.filter((s) => s.status === "active").length : students.length;
  return { dataset: serializeDataset(ds, activeCount), students: students.map(serializeStudent) };
});

/** Manual "Add Student" (backup to file import). */
export const POST = route<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const ds = await getDataset(user, id);
  const body = await parseBody(req, studentSchema);
  const roll = canonicalRoll(body.rollNumber, (ds.rollFormat ?? "numeric") as RollFormat);
  if (!roll.ok) throw new ApiError(400, roll.reason, "invalid_roll");
  const name = normalizeName(body.name);
  const existing = await Student.findOne({ datasetId: ds._id, rollNumber: roll.value, deletedAt: null });
  if (existing) {
    throw new ApiError(
      409,
      existing.status === "inactive"
        ? `Roll number ${roll.value} belongs to a deactivated student (${existing.name}). Reactivate them instead.`
        : `Roll number ${roll.value} is already assigned to ${existing.name}.`,
      "duplicate_roll",
    );
  }
  const s = await Student.create({ owner: user._id, datasetId: ds._id, rollNumber: roll.value, name });
  return { student: serializeStudent(s.toObject()) };
});
