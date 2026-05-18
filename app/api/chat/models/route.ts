import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";

import { getSessionUser } from "@/lib/auth";

export async function GET() {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return NextResponse.json({ error: "advisor_unavailable" }, { status: 503 });

  try {
    const ai = new GoogleGenAI({ apiKey });
    const models: string[] = [];
    const pager = await ai.models.list();
    for await (const m of pager) {
      // keep only text-generation capable gemini models
      if (
        m.name &&
        m.name.includes("gemini") &&
        m.supportedActions?.includes("generateContent")
      ) {
        models.push(m.name.replace("models/", ""));
      }
    }
    models.sort((a, b) => {
      // sort descending: 2.5 before 2.0 before 1.5, preview after stable within version
      return b.localeCompare(a, undefined, { numeric: true });
    });
    return NextResponse.json({ models });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const isKeyError = msg.includes("leaked") || msg.includes("API key") || msg.includes("PERMISSION_DENIED");
    return NextResponse.json(
      { error: isKeyError ? "api_key_invalid" : "list_failed" },
      { status: isKeyError ? 403 : 502 },
    );
  }
}
