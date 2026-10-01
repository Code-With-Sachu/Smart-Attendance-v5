import { route, requireUser, parseBody, ApiError, escapeRegex } from "@/lib/api";
import { MainModule } from "@/lib/models";
import { mainModuleSchema } from "@/lib/validators";
import { moduleOverview } from "@/lib/services";

export const GET = route(async () => {
  const user = await requireUser();
  return { modules: await moduleOverview(user) };
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const body = await parseBody(req, mainModuleSchema);
  const dup = await MainModule.exists({
    owner: user._id,
    archivedAt: null,
    name: { $regex: `^${escapeRegex(body.name)}$`, $options: "i" },
  });
  if (dup) throw new ApiError(409, `A module named "${body.name}" already exists.`, "duplicate_name");
  const m = await MainModule.create({ ...body, owner: user._id });
  return { id: String(m._id) };
});
