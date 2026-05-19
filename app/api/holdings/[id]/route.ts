import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!user.canEdit) return new Response("Forbidden", { status: 403 });

  const { id } = await params;
  await prisma.holding.deleteMany({
    where: { id: Number(id), householdId: user.householdId },
  });
  return Response.json({ ok: true });
}
