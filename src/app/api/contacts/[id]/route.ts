import { route, requireUser, parseBody, ApiError, oid, notFound } from "@/lib/api";
import { WhatsAppContact } from "@/lib/models";
import { contactSchema } from "@/lib/validators";
import { normalizePhone } from "@/lib/phone";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const body = await parseBody(req, contactSchema);
  const phone = normalizePhone(body.phone);
  if (!phone.ok) throw new ApiError(400, phone.reason, "invalid_phone");
  const _id = oid(id, "Contact");
  if (await WhatsAppContact.exists({ owner: user._id, phone: phone.value, _id: { $ne: _id } })) {
    throw new ApiError(409, "This WhatsApp number is already saved.", "duplicate_phone");
  }
  const r = await WhatsAppContact.updateOne(
    { _id, owner: user._id },
    { $set: { name: body.name, phone: phone.value, label: body.label } },
  );
  if (!r.matchedCount) throw notFound("Contact");
  return { ok: true };
});

export const DELETE = route<Ctx>(async (_req, { params }) => {
  const user = await requireUser();
  const { id } = await params;
  const r = await WhatsAppContact.deleteOne({ _id: oid(id, "Contact"), owner: user._id });
  if (!r.deletedCount) throw notFound("Contact");
  return { ok: true };
});
