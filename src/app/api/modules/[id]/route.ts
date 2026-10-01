import { route, requireUser, parseBody, ApiError, escapeRegex } from "@/lib/api";
import { MainModule, SubModule } from "@/lib/models";
import { mainModuleSchema } from "@/lib/validators";
import { getMainModule, moduleOverview } from "@/lib/services";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  await getMainModule(user, id);
  const mod = (await moduleOverview(user)).find((m) => m.id === id);
  return { module: mod };
});

export const PATCH = route<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const m = await getMainModule(user, id);
  const body = await parseBody(req, mainModuleSchema);
  const dup = await MainModule.exists({
    owner: user._id,
    archivedAt: null,
    _id: { $ne: m._id },
    name: { $regex: `^${escapeRegex(body.name)}$`, $options: "i" },
  });
  if (dup) throw new ApiError(409, `A module named "${body.name}" already exists.`, "duplicate_name");
  await MainModule.updateOne({ _id: m._id }, { $set: body });
  return { ok: true };
});

/** Archives the module and its sub modules. Attendance history is kept. */
export const DELETE = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const m = await getMainModule(user, id);
  const now = new Date();
  await SubModule.updateMany({ owner: user._id, mainModuleId: m._id, archivedAt: null }, { $set: { archivedAt: now } });
  await MainModule.updateOne({ _id: m._id }, { $set: { archivedAt: now } });
  return { ok: true };
});
