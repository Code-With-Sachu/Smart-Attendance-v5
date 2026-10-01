import { route, requireUser, parseBody, ApiError } from "@/lib/api";
import { WhatsAppContact } from "@/lib/models";
import { contactSchema } from "@/lib/validators";
import { normalizePhone } from "@/lib/phone";

function serializeContact(c: { _id: unknown; name: string; phone: string; label?: string | null }) {
  return { id: String(c._id), name: c.name, phone: c.phone, label: c.label ?? "" };
}

export const GET = route(async () => {
  const user = await requireUser();
  const list = await WhatsAppContact.find({ owner: user._id }).sort({ name: 1 }).lean();
  return { contacts: list.map(serializeContact) };
});

export const POST = route(async (req) => {
  const user = await requireUser();
  const body = await parseBody(req, contactSchema);
  const phone = normalizePhone(body.phone);
  if (!phone.ok) throw new ApiError(400, phone.reason, "invalid_phone");
  if (await WhatsAppContact.exists({ owner: user._id, phone: phone.value })) {
    throw new ApiError(409, "This WhatsApp number is already saved.", "duplicate_phone");
  }
  if ((await WhatsAppContact.countDocuments({ owner: user._id })) >= 50) {
    throw new ApiError(400, "You can save up to 50 WhatsApp contacts.", "limit");
  }
  const c = await WhatsAppContact.create({ owner: user._id, name: body.name, phone: phone.value, label: body.label });
  return { contact: serializeContact(c.toObject()) };
});
