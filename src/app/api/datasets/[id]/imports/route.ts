import { route, requireUser } from "@/lib/api";
import { FileImport } from "@/lib/models";
import { getDataset } from "@/lib/services";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const ds = await getDataset(user, id);
  const imports = await FileImport.find({ owner: user._id, datasetId: ds._id }).sort({ createdAt: -1 }).limit(50).lean();
  return {
    imports: imports.map((i) => ({
      id: String(i._id),
      fileName: i.fileName,
      source: i.source,
      fileKind: i.fileKind,
      totalRows: i.totalRows ?? 0,
      added: i.added ?? 0,
      updated: i.updated ?? 0,
      removed: i.removed ?? 0,
      unchanged: i.unchanged ?? 0,
      changes: i.changes ?? [],
      createdAt: (i as unknown as { createdAt: Date }).createdAt.toISOString(),
    })),
  };
});
