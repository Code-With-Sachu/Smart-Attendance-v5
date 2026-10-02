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

export const runtime = "nodejs";

/**
 * Normalize a student name for reliable comparison.
 */
function normalizeName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Detect questions such as:
 *
 * What is Aswin Suresh's roll number?
 * What is the roll number of Aswin Suresh?
 * Roll number of Aswin Suresh?
 */
function extractStudentName(message: string) {
  const patterns = [
    /(?:what is|what's)\s+(.+?)['’]s\s+roll\s*(?:number|no)?(?:\?|$)/i,

    /(?:what is|what's|tell me|show me|give me)?\s*(?:the\s+)?(?:roll\s*(?:number|no)|roll)\s+(?:of|for)\s+(.+?)(?:\?|$)/i,

    /(?:roll\s*(?:number|no)\s*(?:of|for))\s+(.+?)(?:\?|$)/i,
  ];

  for (const pattern of patterns) {
    const match = message.match(pattern);

    if (match?.[1]) {
      return match[1]
        .replace(/[?.,!]+$/, "")
        .trim();
    }
  }

  return null;
}

/**
 * Detect student-count questions.
 */
function isStudentCountQuestion(message: string) {
  const text = message.toLowerCase();

  return (
    text.includes("how many students") ||
    text.includes("number of students") ||
    text.includes("student count") ||
    text.includes("total students")
  );
}

/**
 * Detect student-list questions.
 */
function isStudentListQuestion(message: string) {
  const text = message.toLowerCase();

  return (
    text.includes("student list") ||
    text.includes("list of students") ||
    text.includes("show my students") ||
    text.includes("show all students") ||
    text.includes("all students")
  );
}

/**
 * Build a smaller AI context for questions that actually need Gemini.
 */
function buildCompactContext(data: {
  students: unknown[];
  sessions: unknown[];
  datasets: unknown[];
}) {
  return [
    "STUDENT DATA:",
    JSON.stringify(data.students),
    "",
    "ATTENDANCE DATA:",
    JSON.stringify(data.sessions),
    "",
    "DATASETS:",
    JSON.stringify(data.datasets),
  ].join("\n");
}

export const POST = route(async (req) => {
  const user = await requireUser();

  const body = await parseBody<AssistantBody>(
    req,
    assistantBodySchema,
  );

  try {
    const owner = user._id;
    const message = body.message.trim();

    /*
     * FAST PATH 1
     *
     * Direct student roll-number lookup.
     *
     * Gemini is NOT called here.
     */
    const requestedStudentName = extractStudentName(message);

    if (requestedStudentName) {
      const normalizedRequestedName =
        normalizeName(requestedStudentName);

      const students = await Student.find({
        owner,
        deletedAt: null,
      })
        .select({
          name: 1,
          rollNumber: 1,
        })
        .limit(500)
        .lean();

      /*
       * First try an exact name match.
       */
      const exactStudent = students.find(
        (student) =>
          normalizeName(student.name) ===
          normalizedRequestedName,
      );

      if (exactStudent) {
        return NextResponse.json({
          answer: `The roll number of ${exactStudent.name} is ${exactStudent.rollNumber}.`,
          error: null,
        });
      }

      /*
       * Then try a partial name match.
       */
      const partialStudents = students.filter((student) =>
        normalizeName(student.name).includes(
          normalizedRequestedName,
        ),
      );

      if (partialStudents.length === 1) {
        const student = partialStudents[0];

        return NextResponse.json({
          answer: `The roll number of ${student.name} is ${student.rollNumber}.`,
          error: null,
        });
      }

      /*
       * Multiple students matched.
       */
      if (partialStudents.length > 1) {
        return NextResponse.json({
          answer:
            "I found multiple students matching that name. Please provide the student's full name.",
          error: null,
        });
      }

      /*
       * No student matched.
       */
      return NextResponse.json({
        answer: `I couldn't find a student named ${requestedStudentName} in your Smart Attendance data.`,
        error: null,
      });
    }

    /*
     * FAST PATH 2
     *
     * Student count.
     *
     * Gemini is NOT called.
     */
    if (isStudentCountQuestion(message)) {
      const count = await Student.countDocuments({
        owner,
        deletedAt: null,
      });

      return NextResponse.json({
        answer: `You currently have ${count} students in your Smart Attendance data.`,
        error: null,
      });
    }

    /*
     * FAST PATH 3
     *
     * Student list.
     *
     * Gemini is NOT called.
     */
    if (isStudentListQuestion(message)) {
      const students = await Student.find({
        owner,
        deletedAt: null,
      })
        .select({
          name: 1,
          rollNumber: 1,
        })
        .sort({
          rollNumber: 1,
          name: 1,
        })
        .limit(500)
        .lean();

      if (students.length === 0) {
        return NextResponse.json({
          answer:
            "No students were found in your Smart Attendance data.",
          error: null,
        });
      }

      const list = students
        .map(
          (student, index) =>
            `${index + 1}. ${student.name} — Roll ${student.rollNumber}`,
        )
        .join("\n");

      return NextResponse.json({
        answer: `You have ${students.length} students:\n${list}`,
        error: null,
      });
    }

    /*
     * NORMAL AI PATH
     *
     * Only questions that need Gemini reach this section.
     *
     * We also reduce the amount of MongoDB data sent to Gemini.
     */

    const [students, sessions, datasets] =
      await Promise.all([
        Student.find({
          owner,
          deletedAt: null,
        })
          .select({
            name: 1,
            rollNumber: 1,
            status: 1,
          })
          .sort({
            name: 1,
          })
          .limit(100)
          .lean(),

        AttendanceSession.find({
          owner,
        })
          .sort({
            date: -1,
            createdAt: -1,
          })
          .limit(30)
          .lean(),

        StudentDataset.find({
          owner,
        })
          .select({
            name: 1,
            scope: 1,
            subModuleId: 1,
            rollFormat: 1,
            lastImportedAt: 1,
          })
          .sort({
            createdAt: -1,
          })
          .limit(10)
          .lean(),
      ]);

    const context = buildCompactContext({
      students,
      sessions,
      datasets,
    });

    const answer = await generateSMResponse(
      message,
      context,
      body.conversation.slice(-6),
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
      {
        status: 500,
      },
    );
  }
});


