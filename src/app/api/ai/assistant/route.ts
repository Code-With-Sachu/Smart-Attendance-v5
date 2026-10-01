import { NextResponse } from "next/server";

import { route, parseBody, ApiError, getSessionUser } from "@/lib/api";
import {
  AttendanceSession,
  FileImport,
  Student,
  StudentDataset,
  type AttendanceSessionDoc,
  type StudentDoc,
} from "@/lib/models";
import { generateSMResponse } from "@/lib/ai/gemini";

type Message = {
  role: "user" | "model";
  text: string;
};

type AssistantBody = {
  message: string;
  conversation: Message[];
};

function buildApplicationContext(
  students: StudentDoc[],
  sessions: AttendanceSessionDoc[],
  datasets: Array<{
    _id: unknown;
    name: string;
    scope: string;
    subModuleId?: unknown;
    lastImportedAt?: Date | null;
  }>,
  imports: Array<{
    fileName: string;
    fileKind?: string;
    source: string;
    totalRows?: number;
    added?: number;
    updated?: number;
    removed?: number;
    unchanged?: number;
  }>,
) {
  const studentLines = students.map(
    (s) =>
      `- Roll: ${s.rollNumber} | Name: ${s.name} | Status: ${s.status}`,
  );

  const sessionLines = sessions.map((s) => {
    const records = (s.records ?? [])
      .map(
        (r) =>
          `${r.rollNumberSnapshot} - ${r.studentNameSnapshot}: ${r.status}`,
      )
      .join("; ");

    return [
      `Date: ${s.date}`,
      `Time: ${s.time}`,
      `Module: ${s.mainModuleName}`,
      `Submodule: ${s.subModuleName}`,
      `Session: ${s.sessionLabel ?? "Session 1"}`,
      `Total: ${s.total ?? 0}`,
      `Present: ${s.present ?? 0}`,
      `Absent: ${s.absent ?? 0}`,
      `Records: ${records || "No records"}`,
    ].join(" | ");
  });

  const datasetLines = datasets.map(
    (d) =>
      `- ${d.name} | Scope: ${d.scope} | Last imported: ${
        d.lastImportedAt
          ? new Date(d.lastImportedAt).toISOString()
          : "Never"
      }`,
  );

  const importLines = imports.map(
    (i) =>
      `- ${i.fileName} | Kind: ${i.fileKind ?? "unknown"} | Source: ${
        i.source
      } | Rows: ${i.totalRows ?? 0}`,
  );

  return `
PROFILE DATASETS:
${datasetLines.length ? datasetLines.join("\n") : "No Profile datasets found."}

STUDENTS:
${studentLines.length ? studentLines.join("\n") : "No students found."}

ATTENDANCE:
${sessionLines.length ? sessionLines.join("\n") : "No attendance sessions found."}

PROFILE IMPORTS:
${importLines.length ? importLines.join("\n") : "No imports found."}
`.trim();
}

export const POST = route(async (req) => {
  try {
    const user = await getSessionUser();

    if (!user) {
      throw new ApiError(
        401,
        "Please sign in to use SM.",
        "unauthorized",
      );
    }

    const body = (await parseBody(
      req,
      {
        safeParse(value: unknown) {
          if (!value || typeof value !== "object") {
            return {
              success: false,
              error: new Error("Invalid request."),
            } as never;
          }

          const data = value as {
            message?: unknown;
            conversation?: unknown;
          };

          if (
            typeof data.message !== "string" ||
            data.message.trim().length === 0
          ) {
            return {
              success: false,
              error: new Error("Message is required."),
            } as never;
          }

          const conversation: Message[] =
            Array.isArray(data.conversation)
              ? data.conversation
                  .filter(
                    (item): item is Message =>
                      !!item &&
                      typeof item === "object" &&
                      ((item as Message).role === "user" ||
                        (item as Message).role === "model") &&
                      typeof (item as Message).text === "string",
                  )
                  .slice(-10)
              : [];

          return {
            success: true,
            data: {
              message: data.message.trim(),
              conversation,
            },
          } as never;
        },
      } as never,
    )) as AssistantBody;

    console.log("SM request:", body.message);
    console.log("SM user:", String(user._id));

    const [datasets, students, sessions, imports] = await Promise.all([
      StudentDataset.find({
        owner: user._id,
      })
        .select("_id name scope subModuleId lastImportedAt")
        .sort({ scope: 1, name: 1 })
        .lean(),

      Student.find({
        owner: user._id,
        deletedAt: null,
      })
        .select("_id datasetId rollNumber name status")
        .sort({ rollNumber: 1 })
        .lean<StudentDoc[]>(),

      AttendanceSession.find({
        owner: user._id,
      })
        .sort({ date: -1, time: -1 })
        .limit(100)
        .lean<AttendanceSessionDoc[]>(),

      FileImport.find({
        owner: user._id,
      })
        .select(
          "fileName fileKind source totalRows added updated removed unchanged",
        )
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
    ]);

    console.log("SM data:", {
      students: students.length,
      datasets: datasets.length,
      sessions: sessions.length,
      imports: imports.length,
    });

    const context = buildApplicationContext(
      students,
      sessions,
      datasets,
      imports,
    );

    const answer = await generateSMResponse(
      body.message,
      context,
      body.conversation,
    );

    console.log("SM response generated successfully.");

    return NextResponse.json({
      answer,
      assistant: "SM",
    });
  } catch (error) {
    console.error("========== SM API ERROR ==========");
    console.error(error);
    console.error("==================================");

    return NextResponse.json(
      {
        answer: null,
        error: "SM request failed.",
        details:
          process.env.NODE_ENV === "development" && error instanceof Error
            ? error.message
            : undefined,
      },
      { status: 500 },
    );
  }
});
