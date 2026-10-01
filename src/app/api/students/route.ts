import { route, requireUser, escapeRegex, oid } from "@/lib/api";
import { Student, type StudentDoc } from "@/lib/models";
import { getDataset, serializeStudent } from "@/lib/services";
import { compareRoll } from "@/lib/roll";

/** Paginated search across all of the teacher's students. */
export const GET = route(async (req) => {
  const user = await requireUser();
  const sp = req.nextUrl.searchParams;
  const q = (sp.get("q") ?? "").trim().slice(0, 80);
  const status = sp.get("status");
  const datasetId = sp.get("datasetId");
  const page = Math.max(1, Number(sp.get("page") ?? 1) || 1);
  const pageSize = Math.min(200, Math.max(10, Number(sp.get("pageSize") ?? 50) || 50));

  const filter: Record<string, unknown> = { owner: user._id, deletedAt: null };
  if (datasetId) {
    await getDataset(user, datasetId);
    filter.datasetId = oid(datasetId);
  }
  if (status === "active" || status === "inactive") filter.status = status;
  if (q) {
    const rx = { $regex: escapeRegex(q), $options: "i" };
    const rollQ = q.replace(/^0+(?=\d)/, "");
    filter.$or = [{ name: rx }, { rollNumber: { $regex: `^${escapeRegex(rollQ)}`, $options: "i" } }];
  }
  const all = await Student.find(filter).lean<StudentDoc[]>();
  all.sort((a, b) => String(a.datasetId).localeCompare(String(b.datasetId)) || compareRoll(a.rollNumber, b.rollNumber));
  const total = all.length;
  const items = all.slice((page - 1) * pageSize, page * pageSize).map(serializeStudent);
  return { students: items, total, page, pageSize, pages: Math.max(1, Math.ceil(total / pageSize)) };
});
