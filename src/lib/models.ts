import "server-only";
import mongoose, { Schema, type Model, Types } from "mongoose";

const { ObjectId } = Schema.Types;
const opts = { timestamps: true } as const;

// Plain interfaces (instead of InferSchemaType) keep TypeScript fast.
type Base = { _id: Types.ObjectId; createdAt: Date; updatedAt: Date };

function model<T>(name: string, schema: Schema): Model<T> {
  return (mongoose.models[name] as unknown as Model<T>) ?? (mongoose.model(name, schema) as unknown as Model<T>);
}

/* ---------------------------------- User --------------------------------- */
const UserSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 160 },
    passwordHash: { type: String, required: true },
    subject: { type: String, default: "", maxlength: 80 },
    teacherId: { type: String, default: "", maxlength: 40 },
    photo: { type: String, default: "" }, // small data URL (≤ 300 KB, validated server-side)
    preferences: {
      attendanceView: { type: String, enum: ["compact", "detailed"], default: "detailed" },
      lowAttendanceThreshold: { type: Number, default: 75, min: 0, max: 100 },
    },
    profileDatasetId: { type: ObjectId, ref: "StudentDataset", default: null },
    sessionVersion: { type: Number, default: 0 }, // bump to invalidate all sessions
    resetTokenHash: { type: String, default: null },
    resetTokenExpires: { type: Date, default: null },
  },
  opts,
);
export interface UserDoc extends Base {
  name: string;
  email: string;
  passwordHash: string;
  subject?: string;
  teacherId?: string;
  photo?: string;
  preferences?: { attendanceView?: "compact" | "detailed"; lowAttendanceThreshold?: number };
  profileDatasetId?: Types.ObjectId | null;
  sessionVersion?: number;
  resetTokenHash?: string | null;
  resetTokenExpires?: Date | null;
}
export const User = model<UserDoc>("User", UserSchema);

/* ------------------------------ Main module ------------------------------ */
const MainModuleSchema = new Schema(
  {
    owner: { type: ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    number: { type: Number, required: true, min: 1, max: 9999 },
    color: { type: String, default: "#6366f1", match: /^#[0-9a-fA-F]{6}$/ },
    archivedAt: { type: Date, default: null },
  },
  opts,
);
MainModuleSchema.index({ owner: 1, archivedAt: 1, number: 1 });
export interface MainModuleDoc extends Base {
  owner: Types.ObjectId;
  name: string;
  number: number;
  color?: string;
  archivedAt?: Date | null;
}
export const MainModule = model<MainModuleDoc>("MainModule", MainModuleSchema);

/* ------------------------------- Sub module ------------------------------ */
const SubModuleSchema = new Schema(
  {
    owner: { type: ObjectId, ref: "User", required: true, index: true },
    mainModuleId: { type: ObjectId, ref: "MainModule", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    code: { type: String, default: "", trim: true, maxlength: 20 },
    datasetId: { type: ObjectId, ref: "StudentDataset", required: true },
    archivedAt: { type: Date, default: null },
  },
  opts,
);
export interface SubModuleDoc extends Base {
  owner: Types.ObjectId;
  mainModuleId: Types.ObjectId;
  name: string;
  code?: string;
  datasetId: Types.ObjectId;
  archivedAt?: Date | null;
}
export const SubModule = model<SubModuleDoc>("SubModule", SubModuleSchema);

/* ---------------------------- Student dataset ---------------------------- */
// A dataset is a named student list. Each sub module owns one; the teacher's
// profile also has a reusable "master" dataset that can be copied into modules.
const StudentDatasetSchema = new Schema(
  {
    owner: { type: ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, maxlength: 120 },
    scope: { type: String, enum: ["submodule", "profile"], required: true },
    subModuleId: { type: ObjectId, ref: "SubModule", default: null },
    rollFormat: { type: String, enum: ["numeric", "alphanumeric"], default: "numeric" },
    lastImportedAt: { type: Date, default: null },
  },
  opts,
);
export interface StudentDatasetDoc extends Base {
  owner: Types.ObjectId;
  name: string;
  scope: "submodule" | "profile";
  subModuleId?: Types.ObjectId | null;
  rollFormat?: "numeric" | "alphanumeric";
  lastImportedAt?: Date | null;
}
export const StudentDataset = model<StudentDatasetDoc>("StudentDataset", StudentDatasetSchema);

/* -------------------------------- Student -------------------------------- */
const StudentSchema = new Schema(
  {
    owner: { type: ObjectId, ref: "User", required: true, index: true },
    datasetId: { type: ObjectId, ref: "StudentDataset", required: true, index: true },
    rollNumber: { type: String, required: true, maxlength: 32 }, // canonical form
    name: { type: String, required: true, trim: true, maxlength: 120 },
    status: { type: String, enum: ["active", "inactive"], default: "active" },
    deletedAt: { type: Date, default: null }, // soft delete — history keeps its snapshot
  },
  opts,
);
StudentSchema.index({ datasetId: 1, rollNumber: 1 });
export interface StudentDoc extends Base {
  owner: Types.ObjectId;
  datasetId: Types.ObjectId;
  rollNumber: string;
  name: string;
  status: "active" | "inactive";
  deletedAt?: Date | null;
}
export const Student = model<StudentDoc>("Student", StudentSchema);

/* ------------------------------ File import ------------------------------ */
const FileImportSchema = new Schema(
  {
    owner: { type: ObjectId, ref: "User", required: true, index: true },
    datasetId: { type: ObjectId, ref: "StudentDataset", required: true, index: true },
    fileName: { type: String, required: true, maxlength: 200 },
    source: { type: String, enum: ["file", "google-sheet", "profile-copy"], required: true },
    fileKind: { type: String, default: "" },
    totalRows: Number,
    added: Number,
    updated: Number,
    removed: Number,
    unchanged: Number,
    changes: [
      {
        _id: false,
        type: { type: String, enum: ["added", "updated", "removed"] },
        rollNumber: String,
        name: String,
        previousName: String,
      },
    ],
  },
  opts,
);
export interface FileImportDoc extends Base {
  owner: Types.ObjectId;
  datasetId: Types.ObjectId;
  fileName: string;
  source: "file" | "google-sheet" | "profile-copy";
  fileKind?: string;
  totalRows?: number;
  added?: number;
  updated?: number;
  removed?: number;
  unchanged?: number;
  changes?: { type: "added" | "updated" | "removed"; rollNumber: string; name: string; previousName?: string }[];
}
export const FileImport = model<FileImportDoc>("FileImport", FileImportSchema);

/* ------------------------- Attendance session ---------------------------- */
// Records are embedded so a session is written atomically (no partial
// submissions) and each record keeps an immutable snapshot of the student.
const AttendanceRecordSchema = new Schema(
  {
    studentId: { type: ObjectId, ref: "Student", required: true },
    rollNumberSnapshot: { type: String, required: true },
    studentNameSnapshot: { type: String, required: true },
    status: { type: String, enum: ["present", "absent"], required: true },
  },
  { _id: false },
);

const AttendanceSessionSchema = new Schema(
  {
    owner: { type: ObjectId, ref: "User", required: true, index: true },
    mainModuleId: { type: ObjectId, ref: "MainModule", required: true },
    subModuleId: { type: ObjectId, ref: "SubModule", required: true, index: true },
    mainModuleName: { type: String, required: true },
    subModuleName: { type: String, required: true },
    date: { type: String, required: true, match: /^\d{4}-\d{2}-\d{2}$/ }, // local class date
    time: { type: String, required: true, match: /^\d{2}:\d{2}$/ },
    sessionLabel: { type: String, default: "Session 1", maxlength: 40 },
    total: Number,
    present: Number,
    absent: Number,
    records: { type: [AttendanceRecordSchema], default: [] },
    clientId: { type: String, default: null }, // idempotency key from the device
    editCount: { type: Number, default: 0 },
  },
  opts,
);
// Duplicate protection: one session per teacher + sub module + date + label
AttendanceSessionSchema.index({ owner: 1, subModuleId: 1, date: 1, sessionLabel: 1 }, { unique: true });
AttendanceSessionSchema.index({ owner: 1, date: -1 });
export interface AttendanceRecord {
  studentId: Types.ObjectId;
  rollNumberSnapshot: string;
  studentNameSnapshot: string;
  status: "present" | "absent";
}
export interface AttendanceSessionDoc extends Base {
  owner: Types.ObjectId;
  mainModuleId: Types.ObjectId;
  subModuleId: Types.ObjectId;
  mainModuleName: string;
  subModuleName: string;
  date: string;
  time: string;
  sessionLabel?: string;
  total?: number;
  present?: number;
  absent?: number;
  records: AttendanceRecord[];
  clientId?: string | null;
  editCount?: number;
}
export const AttendanceSession = model<AttendanceSessionDoc>("AttendanceSession", AttendanceSessionSchema);

/* ---------------------------- WhatsApp contact --------------------------- */
const WhatsAppContactSchema = new Schema(
  {
    owner: { type: ObjectId, ref: "User", required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, required: true }, // E.164 digits, e.g. "919876543210"
    label: { type: String, default: "", trim: true, maxlength: 60 },
  },
  opts,
);
WhatsAppContactSchema.index({ owner: 1, phone: 1 }, { unique: true });
export interface WhatsAppContactDoc extends Base {
  owner: Types.ObjectId;
  name: string;
  phone: string;
  label?: string;
}
export const WhatsAppContact = model<WhatsAppContactDoc>("WhatsAppContact", WhatsAppContactSchema);
