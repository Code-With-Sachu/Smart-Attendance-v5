import { route, requireUser, parseBody } from "@/lib/api";
import { importCommitSchema } from "@/lib/validators";
import { applyImport, getDataset } from "@/lib/services";

/** Applies a teacher-confirmed import. Re-validated server-side. */
export const POST = route(async (req) => {
  const user = await requireUser();
  const body = await parseBody(req, importCommitSchema);
  const ds = await getDataset(user, body.datasetId);
  const result = await applyImport(user, ds, {
    students: body.students,
    rollFormat: body.rollFormat,
    removeMissing: body.removeMissing,
    fileName: body.fileName,
    source: body.source,
    fileKind: body.fileKind,
  });
  return result;
});
