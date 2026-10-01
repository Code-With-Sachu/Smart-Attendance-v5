import { route, requireUser } from "@/lib/api";
import { MainModule, Student, StudentDataset, SubModule, type SubModuleDoc } from "@/lib/models";
import { getMainModule, listStudents } from "@/lib/services";
import { Types } from "mongoose";

type Ctx = { params: Promise<{ id: string }> };

/** Copies a module, its sub modules and their current student lists (not attendance). */
export const POST = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const src = await getMainModule(user, id);
  const copy = await MainModule.create({
    owner: user._id,
    name: `${src.name} (copy)`.slice(0, 60),
    number: src.number,
    color: src.color,
  });
  const subs = await SubModule.find({ owner: user._id, mainModuleId: src._id, archivedAt: null }).lean<SubModuleDoc[]>();
  for (const s of subs) {
    const srcDs = await StudentDataset.findById(s.datasetId).lean();
    const ds = await StudentDataset.create({
      owner: user._id,
      name: s.name,
      scope: "submodule",
      rollFormat: srcDs?.rollFormat ?? "numeric",
    });
    const sub = await SubModule.create({ owner: user._id, mainModuleId: copy._id, name: s.name, code: s.code, datasetId: ds._id });
    await StudentDataset.updateOne({ _id: ds._id }, { subModuleId: sub._id });
    const students = await listStudents(s.datasetId as Types.ObjectId);
    if (students.length)
      await Student.insertMany(
        students.map((st) => ({ owner: user._id, datasetId: ds._id, rollNumber: st.rollNumber, name: st.name })),
      );
  }
  return { id: String(copy._id) };
});
