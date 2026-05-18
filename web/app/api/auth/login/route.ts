import { NextResponse } from "next/server";
import { z } from "zod";

import {
  createSessionToken,
  getSessionCookieName,
  getSessionCookieOptions,
  verifyUserPassword,
} from "@/lib/auth";

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(request: Request) {
  const json = await request.json();
  const parsed = schema.safeParse(json);

  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const user = await verifyUserPassword(parsed.data.email, parsed.data.password);
  if (!user) {
    return NextResponse.json({ error: "invalid_credentials" }, { status: 401 });
  }

  const token = await createSessionToken(user.id);
  const response = NextResponse.json({ ok: true });
  response.cookies.set(getSessionCookieName(), token, getSessionCookieOptions());
  return response;
}
