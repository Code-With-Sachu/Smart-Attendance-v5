import { z } from "zod";

export const objectId = z.string().regex(/^[a-f0-9]{24}$/i, "Invalid id");
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date");
export const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Invalid time");
const hexColor = z.string().regex(/^#[0-9a-fA-F]{6}$/, "Pick a valid color");

export const registerSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(80),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(160),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(128)
    .regex(/[A-Za-z]/, "Password must contain a letter")
    .regex(/\d/, "Password must contain a number"),
});
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password").max(128),
});

export const mainModuleSchema = z.object({
  name: z.string().trim().min(1, "Module name is required").max(60, "Keep the name under 60 characters"),
  number: z.coerce.number().int("Module number must be a whole number").min(1, "Module number must be positive").max(9999),
  color: hexColor,
});

export const subModuleSchema = z.object({
  mainModuleId: z.string().regex(/^[a-f0-9]{24}$/i, "Choose a main module"),
  name: z.string().trim().min(1, "Sub module name is required").max(80),
  code: z.string().trim().max(20).optional().default(""),
});

export const studentSchema = z.object({
  rollNumber: z.string().trim().min(1, "Roll number is required").max(32),
  name: z.string().trim().min(1, "Student name is required").max(120),
});

export const contactSchema = z.object({
  name: z.string().trim().min(1, "Enter a contact name").max(80),
  phone: z.string().trim().min(1, "Enter a WhatsApp number").max(24),
  label: z.string().trim().max(60).optional().default(""),
});

export const attendanceSubmitSchema = z.object({
  subModuleId: objectId,
  date: isoDate,
  time: hhmm,
  sessionLabel: z.string().trim().min(1).max(40).default("Session 1"),
  clientId: z.string().max(64).optional(),
  absentStudentIds: z.array(objectId).max(5000),
  /** Students shown on the teacher's grid — guards against the list changing mid-session. */
  studentIds: z.array(objectId).min(1, "There are no students to submit").max(5000),
});

export const attendanceEditSchema = z.object({
  absentStudentIds: z.array(objectId).max(5000),
});

export const profileSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  subject: z.string().trim().max(80).optional(),
  teacherId: z.string().trim().max(40).optional(),
  photo: z
    .string()
    .max(400_000, "Photo is too large — use an image under 300 KB")
    .regex(/^(data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+)?$/, "Unsupported image")
    .optional(),
  preferences: z
    .object({
      attendanceView: z.enum(["compact", "detailed"]).optional(),
      lowAttendanceThreshold: z.coerce.number().int().min(0).max(100).optional(),
    })
    .optional(),
});

export const importCommitSchema = z.object({
  datasetId: objectId,
  fileName: z.string().trim().min(1).max(200),
  source: z.enum(["file", "google-sheet", "profile-copy"]),
  fileKind: z.string().max(10).optional().default(""),
  rollFormat: z.enum(["numeric", "alphanumeric"]),
  removeMissing: z.boolean().default(true),
  students: z
    .array(z.object({ rollNumber: z.string().max(64), name: z.string().max(200) }))
    .min(1, "There are no students to import")
    .max(5000, "Import at most 5000 students at a time"),
});
