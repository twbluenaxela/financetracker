import { NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { z } from "zod";

import { getSessionUser } from "@/lib/auth";

const schema = z.object({
  system: z.string().min(1).max(2000),
  user: z.string().min(1).max(8000),
  model: z.string().min(1).max(100).default("gemini-3-flash-preview"),
});

export async function POST(request: Request) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const json = await request.json();
  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "advisor_unavailable" }, { status: 503 });
  }

  const ai = new GoogleGenAI({ apiKey });
  const { system, user: userText, model } = parsed.data;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: [{ text: system + "\n\n" + userText }] }],
    });
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    return NextResponse.json({ text });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    const isKeyError = msg.includes("leaked") || msg.includes("API key") || msg.includes("PERMISSION_DENIED");
    return NextResponse.json(
      { error: isKeyError ? "api_key_invalid" : "generation_failed", detail: msg },
      { status: isKeyError ? 403 : 502 },
    );
  }
}
