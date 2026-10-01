/**
 * End-to-end API smoke test.  Usage:
 *   npm run dev            (in another terminal)
 *   node scripts/smoke-test.mjs [baseUrl]
 * Creates a throwaway teacher account and exercises the main flows.
 */
import { readFileSync } from "node:fs";
import ExcelJS from "exceljs";

const BASE = process.argv[2] || "http://localhost:3000";
let cookie = "";
let passed = 0;
let failed = 0;

function check(name, cond, extra) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${name}`);
  } else {
    failed++;
    console.log(`  ✗ ${name}`, extra ?? "");
  }
}

async function api(path, { method = "GET", body, form, auth = true } = {}) {
  const headers = {};
  if (auth && cookie) headers.cookie = cookie;
  let payload;
  if (form) payload = form;
  else if (body !== undefined) {
    headers["content-type"] = "application/json";
    payload = JSON.stringify(body);
  }
  const res = await fetch(BASE + path, { method, headers, body: payload, redirect: "manual" });
  const set = res.headers.get("set-cookie");
  if (set && set.includes("sa_session=")) cookie = set.split(";")[0];
  const type = res.headers.get("content-type") || "";
  const data = type.includes("json") ? await res.json() : await res.text();
  return { status: res.status, data, headers: res.headers };
}

function fileForm(name, buf, type = "text/csv") {
  const f = new FormData();
  f.append("file", new Blob([buf], { type }), name);
  return f;
}

const email = `teacher_${Date.now()}@example.com`;
console.log(`Smoke test against ${BASE}\n`);

console.log("Auth");
check("unauthenticated API → 401", (await api("/api/modules", { auth: false })).status === 401);
check("weak password rejected", (await api("/api/auth/register", { method: "POST", body: { name: "T", email, password: "short" } })).status === 400);
let r = await api("/api/auth/register", { method: "POST", body: { name: "Sachu", email, password: "attend123" } });
check("register", r.status === 200 && cookie, r.data);
check("me", (await api("/api/me")).data.user?.email === email);
check("duplicate email rejected", (await api("/api/auth/register", { method: "POST", body: { name: "Xavier", email, password: "attend123" }, auth: false })).status === 409);

console.log("\nModules");
r = await api("/api/modules", { method: "POST", body: { name: "CSE S3", number: 3, color: "#6366f1" } });
const mainId = r.data.id;
check("create main module", r.status === 200 && mainId);
check("duplicate module name rejected", (await api("/api/modules", { method: "POST", body: { name: "cse s3", number: 4, color: "#6366f1" } })).status === 409);
check("negative module number rejected", (await api("/api/modules", { method: "POST", body: { name: "X", number: -1, color: "#6366f1" } })).status === 400);
r = await api("/api/submodules", { method: "POST", body: { mainModuleId: mainId, name: "Data Structures" } });
const subId = r.data.id;
const datasetId = r.data.datasetId;
check("create sub module", r.status === 200 && subId && datasetId);

console.log("\nStudent import");
r = await api("/api/imports/parse", { method: "POST", form: fileForm("CSE_S3_Students.csv", readFileSync("samples/CSE_S3_Students.csv")) });
check("parse CSV", r.status === 200 && r.data.table.rows.length === 10, r.data);
check("auto-detect columns (high confidence)", r.data.detection?.confidence === "high" && r.data.detection.mapping.roll === 0 && r.data.detection.mapping.name === 1);

r = await api("/api/imports/parse", { method: "POST", form: fileForm("bad_students.csv", readFileSync("samples/bad_students.csv")) });
check("parse CSV with alternate headers (Reg No / Name of Student)", r.status === 200 && r.data.detection.mapping.roll === 0 && r.data.detection.mapping.name === 1, r.data.detection);

check("empty file rejected", (await api("/api/imports/parse", { method: "POST", form: fileForm("empty.csv", Buffer.alloc(0)) })).status === 422);
check("unsupported type rejected", (await api("/api/imports/parse", { method: "POST", form: fileForm("x.exe", Buffer.from("MZ")) })).status === 422);
check("renamed binary rejected", (await api("/api/imports/parse", { method: "POST", form: fileForm("fake.xlsx", Buffer.from("hello")) })).status === 422);

// XLSX with a title row above the header and odd column names
const wb = new ExcelJS.Workbook();
const ws = wb.addWorksheet("Class");
ws.addRow(["Government Engineering College — CSE S3 class list"]);
ws.addRow([]);
ws.addRow(["Sl", "Roll No.", "Full Name", "Email"]);
for (let i = 1; i <= 120; i++) ws.addRow([i, i, `Student ${String.fromCharCode(65 + (i % 26))} ${i}`, `s${i}@x.edu`]);
const xbuf = Buffer.from(await wb.xlsx.writeBuffer());
r = await api("/api/imports/parse", {
  method: "POST",
  form: fileForm("big.xlsx", xbuf, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
});
check("parse XLSX with title rows (120 students)", r.status === 200 && r.data.table.rows.length === 120 && r.data.detection.mapping.roll === 1 && r.data.detection.mapping.name === 2, r.data.detection);

const students = readFileSync("samples/CSE_S3_Students.csv", "utf8")
  .trim()
  .split("\n")
  .slice(1)
  .map((l) => {
    const [rollNumber, name] = l.split(",");
    return { rollNumber, name };
  });
check(
  "commit rejects duplicate roll numbers",
  (await api("/api/imports/commit", {
    method: "POST",
    body: { datasetId, fileName: "x.csv", source: "file", rollFormat: "numeric", removeMissing: true, students: [...students, { rollNumber: "3", name: "Dup" }] },
  })).status === 422,
);
r = await api("/api/imports/commit", {
  method: "POST",
  body: { datasetId, fileName: "CSE_S3_Students.csv", source: "file", rollFormat: "numeric", removeMissing: true, students },
});
check("commit import (10 added)", r.status === 200 && r.data.added === 10, r.data);

r = await api(`/api/datasets/${datasetId}/students`);
check("students listed in roll order", r.data.students.length === 10 && r.data.students[0].rollNumber === "1" && r.data.students[9].rollNumber === "10");
const list = r.data.students;

console.log("\nAttendance");
const absent = [list[2].id, list[7].id];
const today = new Date().toISOString().slice(0, 10);
const submit = { subModuleId: subId, date: today, time: "09:30", sessionLabel: "Session 1", clientId: "c-1", studentIds: list.map((s) => s.id), absentStudentIds: absent };
r = await api("/api/attendance", { method: "POST", body: submit });
const sessionId = r.data.id;
check("submit attendance", r.status === 200 && sessionId, r.data);
r = await api("/api/attendance", { method: "POST", body: submit });
check("same clientId replay is idempotent", r.status === 200 && r.data.id === sessionId);
r = await api("/api/attendance", { method: "POST", body: { ...submit, clientId: "c-2" } });
check("duplicate session blocked (409 + existingId)", r.status === 409 && r.data.existingId === sessionId);
check("duplicate check endpoint", (await api(`/api/attendance?check=1&subModuleId=${subId}&date=${today}&sessionLabel=Session%201`)).data.exists === true);
r = await api(`/api/attendance/${sessionId}`);
check("detail: 8 present / 2 absent", r.data.session.present === 8 && r.data.session.absent === 2 && r.data.records.filter((x) => x.status === "absent").map((x) => x.name).join() === "Anjali S,Meera Nair", r.data.session);

console.log("\nStudent update + history preservation");
const updated = students.map((s) => (s.rollNumber === "3" ? { ...s, name: "Anjali Suresh" } : s)).filter((s) => s.rollNumber !== "10");
updated.push({ rollNumber: "11", name: "Vishnu R" });
r = await api("/api/imports/commit", {
  method: "POST",
  body: { datasetId, fileName: "update.csv", source: "file", rollFormat: "numeric", removeMissing: true, students: updated },
});
check("re-import diff: +1 ~1 -1", r.data.added === 1 && r.data.updated === 1 && r.data.removed === 1, r.data);
r = await api(`/api/attendance/${sessionId}`);
check("history keeps old name snapshot", r.data.records.find((x) => x.rollNumber === "3").name === "Anjali S");
check("history keeps removed student", r.data.records.some((x) => x.rollNumber === "10"));
r = await api(`/api/students/${list[0].id}`, { method: "DELETE" });
check("soft-delete student", r.status === 200);
r = await api(`/api/attendance/${sessionId}`);
check("history intact after delete", r.data.records.length === 10);

r = await api(`/api/attendance/${sessionId}`, { method: "PATCH", body: { absentStudentIds: [list[2].id] } });
r = await api(`/api/attendance/${sessionId}`);
check("edit existing session", r.data.session.absent === 1 && r.data.session.editCount === 1);

r = await api("/api/attendance", {
  method: "POST",
  body: { ...submit, sessionLabel: "Session 2", clientId: "c-3" },
});
check("stale student list rejected (list_changed)", r.status === 409 && r.data.code === "list_changed", r.data);

console.log("\nManual students");
check("add student", (await api(`/api/datasets/${datasetId}/students`, { method: "POST", body: { rollNumber: "012", name: "  Neha   Thomas " } })).data.student?.name === "Neha Thomas");
check("duplicate roll on add rejected", (await api(`/api/datasets/${datasetId}/students`, { method: "POST", body: { rollNumber: "12", name: "X" } })).status === 409);
check("invalid roll on add rejected", (await api(`/api/datasets/${datasetId}/students`, { method: "POST", body: { rollNumber: "1.5", name: "X" } })).status === 400);

console.log("\nWhatsApp contacts");
r = await api("/api/contacts", { method: "POST", body: { name: "Class Rep", phone: "98765 43210", label: "Class Representative" } });
check("add contact (normalised to 91…)", r.data.contact?.phone === "919876543210", r.data);
check("duplicate number rejected", (await api("/api/contacts", { method: "POST", body: { name: "Dup", phone: "+91 9876543210" } })).status === 409);
check("invalid number rejected", (await api("/api/contacts", { method: "POST", body: { name: "Bad", phone: "12ab" } })).status === 400);
const contactId = r.data.contact?.id;
check("edit contact", (await api(`/api/contacts/${contactId}`, { method: "PATCH", body: { name: "CR", phone: "+919876500000", label: "" } })).status === 200);
check("delete contact", (await api(`/api/contacts/${contactId}`, { method: "DELETE" })).status === 200);

console.log("\nReports, search, stats");
r = await api(`/api/export?type=session&id=${sessionId}&format=csv`);
check("CSV export", r.status === 200 && String(r.data).includes("Anjali S"));
r = await api(`/api/export?type=submodule&id=${subId}&format=xlsx`);
check("XLSX register export", r.status === 200);
check("search by roll", (await api("/api/search?q=03")).data.students.some((s) => s.rollNumber === "3"));
check("search by name", (await api("/api/search?q=meera")).data.students.length === 1);
r = await api(`/api/stats?today=${today}`);
check("dashboard stats", r.data.totals.modules === 1 && r.data.totals.todaysSessions === 1, r.data.totals);
r = await api(`/api/submodules/${subId}`);
check("sub module analytics", r.data.analytics.totalClasses === 1 && r.data.students.find((s) => s.rollNumber === "3").absent === 1);

console.log("\nIsolation between teachers");
const mine = cookie;
cookie = "";
await api("/api/auth/register", { method: "POST", body: { name: "Other", email: `other_${Date.now()}@example.com`, password: "attend123" } });
check("other teacher can't read my session", (await api(`/api/attendance/${sessionId}`)).status === 404);
check("other teacher can't read my students", (await api(`/api/datasets/${datasetId}/students`)).status === 404);
check("other teacher can't import into my list", (await api("/api/imports/commit", { method: "POST", body: { datasetId, fileName: "x", source: "file", rollFormat: "numeric", removeMissing: false, students } })).status === 404);
cookie = mine;

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
