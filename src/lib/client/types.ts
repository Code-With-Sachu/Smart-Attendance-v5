// Response shapes shared by client components (mirrors the API serializers).
export type RollFormat = "numeric" | "alphanumeric";

export type User = {
  id: string;
  name: string;
  email: string;
  subject: string;
  teacherId: string;
  photo: string;
  preferences: { attendanceView: "compact" | "detailed"; lowAttendanceThreshold: number };
};

export type SubModuleSummary = {
  id: string;
  mainModuleId: string;
  name: string;
  code: string;
  datasetId: string;
  studentCount: number;
  lastAttendance: string | null;
  sessions: number;
  averageAttendance: number | null;
};

export type ModuleSummary = {
  id: string;
  name: string;
  number: number;
  color: string;
  subModules: SubModuleSummary[];
  subModuleCount: number;
  studentCount: number;
  lastAttendance: string | null;
};

export type Student = {
  id: string;
  datasetId: string;
  rollNumber: string;
  name: string;
  status: "active" | "inactive";
};

export type Dataset = {
  id: string;
  name: string;
  scope: "submodule" | "profile";
  subModuleId: string | null;
  rollFormat: RollFormat;
  lastImportedAt: string | null;
  studentCount: number;
  label?: string;
};

export type Session = {
  id: string;
  mainModuleId: string;
  subModuleId: string;
  mainModuleName: string;
  subModuleName: string;
  date: string;
  time: string;
  sessionLabel: string;
  total: number;
  present: number;
  absent: number;
  editCount: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type SessionRecord = { studentId: string; rollNumber: string; name: string; status: "present" | "absent" };

export type Contact = { id: string; name: string; phone: string; label: string };

export type SubModuleDetail = {
  subModule: { id: string; name: string; code: string; datasetId: string };
  mainModule: { id: string; name: string; color: string; number: number };
  dataset: Dataset;
  students: (Student & { present: number; absent: number; percentage: number | null })[];
  analytics: { totalClasses: number; averageAttendance: number | null; students: number; recent: Session[] };
};
