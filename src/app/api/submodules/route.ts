import { route, requireUser, parseBody, ApiError, escapeRegex } from "@/lib/api";
import { StudentDataset, SubModule } from "@/lib/models";
import { subModuleSchema } from "@/lib/validators";
import { getMainModule } from "@/lib/services";

export const POST = route(async (req) => {
  const user = await requireUser();
  const body = await parseBody(req, subModuleSchema);
  const main = await getMainModule(user, body.mainModuleId);
  const dup = await SubModule.exists({
    owner: user._id,
    mainModuleId: main._id,
    archivedAt: null,
    name: { $regex: `^${escapeRegex(body.name)}$`, $options: "i" },
  });
  if (dup) throw new ApiError(409, `"${body.name}" already exists in ${main.name}.`, "duplicate_name");
  const ds = await StudentDataset.create({ owner: user._id, name: `${main.name} · ${body.name}`, scope: "submodule" });
  const sub = await SubModule.create({ owner: user._id, mainModuleId: main._id, name: body.name, code: body.code, datasetId: ds._id });
  await StudentDataset.updateOne({ _id: ds._id }, { subModuleId: sub._id });
  return { id: String(sub._id), datasetId: String(ds._id) };
});
