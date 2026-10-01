import { Types } from "mongoose";
import { route, requireUser } from "@/lib/api";
import { MainModule, StudentDataset, SubModule, type StudentDatasetDoc } from "@/lib/models";
import { countActive, ensureProfileDataset, serializeDataset } from "@/lib/services";

/** All student lists the teacher owns: the profile master list + one per sub module. */
export const GET = route(async () => {
  const user = await requireUser();
  const profile = await ensureProfileDataset(user);
  const subs = await SubModule.find({ owner: user._id, archivedAt: null }).lean();
  const mains = await MainModule.find({ owner: user._id, archivedAt: null }).lean();
  const mainName = new Map(mains.map((m) => [String(m._id), m.name]));
  const ids = [profile._id, ...subs.map((s) => s.datasetId as Types.ObjectId)];
  const datasets = await StudentDataset.find({ _id: { $in: ids }, owner: user._id }).lean<StudentDatasetDoc[]>();
  const counts = await countActive(ids);
  const subByDs = new Map(subs.map((s) => [String(s.datasetId), s]));
  const out = datasets.map((d) => {
    const sub = subByDs.get(String(d._id));
    return {
      ...serializeDataset(d, counts.get(String(d._id)) ?? 0),
      label: sub ? `${mainName.get(String(sub.mainModuleId)) ?? ""} · ${sub.name}` : "Profile · Master dataset",
      mainModuleName: sub ? (mainName.get(String(sub.mainModuleId)) ?? "") : null,
      subModuleName: sub?.name ?? null,
    };
  });
  out.sort((a, b) => (a.scope === "profile" ? -1 : b.scope === "profile" ? 1 : a.label.localeCompare(b.label)));
  return { datasets: out, profileDatasetId: String(profile._id) };
});
