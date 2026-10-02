import { NextResponse } from "next/server";
import { generateSMResponse } from "@/lib/ai/gemini";

export const runtime = "nodejs";

export async function GET() {
  try {
    const answer = await generateSMResponse(
      "Reply with exactly: SM AI is working.",
      "No application data for this test.",
      [],
    );

    return NextResponse.json({
      ok: true,
      answer,
    });
  } catch (error) {
    console.error("========== DIRECT SM TEST ERROR ==========");
    console.error(error);
    console.error("==========================================");

    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}