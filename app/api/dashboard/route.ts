import { NextResponse } from "next/server";

import { getSessionUser } from "@/lib/auth";
import { getDashboardData } from "@/lib/dashboard";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const data = await getDashboardData();
  return NextResponse.json(data);
}
