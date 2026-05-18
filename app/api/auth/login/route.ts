import { NextResponse } from "next/server";

import { createSession } from "@/lib/auth";

export async function POST(request: Request) {
  const { idToken } = await request.json().catch(() => ({}));

  if (!idToken || typeof idToken !== "string") {
    return NextResponse.json({ error: "missing_token" }, { status: 400 });
  }

  try {
    await createSession(idToken);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 });
  }
}
