import { NextResponse } from "next/server";
import { z } from "zod";

import { parseBody, requireUser, route } from "@/lib/api";
import { generateSMResponse } from "@/lib/ai/gemini";
import {
  AttendanceSession,
  Student,
  StudentDataset,
} from "@/lib/models";

const assistantBodySchema = z.object({
  message: z.string().trim().min(1, "Message is required."),
  conversation: z
    .array(
      z.object({
        role: z.enum(["user", "model"]),
        text: z.string(),
      }),
    )
    .max(10)
    .default([]),
});

type AssistantBody = z.infer<typeof assistantBodySchema>;

function buildApplicationContext(data: {
  students: unknown[];
  sessions: unknown[];
  datasets: unknown[];
}) {
  return `
STUDENT DATA:
${JSON.stringify(data.students, null, 2)}

ATTENDANCE DATA:
${JSON.stringify(data.sessions, null, 2)}

DATASETS:
${JSON.stringify(data.datasets, null, 2)}
`.trim();
}

export const runtime = "nodejs";

export const POST = route(async (req) => {
  // Authentication errors must remain proper 401 errors.
  const user = await requireUser();

  const body = await parseBody<AssistantBody>(
    req,
    assistantBodySchema,
  );

  try {
    const owner = user._id;

    const [students, sessions, datasets] = await Promise.all([
      Student.find({
        owner,
        deletedAt: null,
      })
        .sort({ name: 1 })
        .limit(500)
        .lean(),

      AttendanceSession.find({
        owner,
      })
        .sort({ date: -1, createdAt: -1 })
        .limit(100)
        .lean(),

      StudentDataset.find({
        owner,
      })
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
    ]);

    const context = buildApplicationContext({
      students,
      sessions,
      datasets,
    });

    const answer = await generateSMResponse(
      body.message,
      context,
      body.conversation,
    );

    return NextResponse.json({
      answer,
      error: null,
    });
  } catch (error) {
    console.error("========== SM API ERROR ==========");
    console.error(error);
    console.error("==================================");

    return NextResponse.json(
      {
        answer: null,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
      { status: 500 },
    );
  }
});
