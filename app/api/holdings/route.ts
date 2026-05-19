import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const Schema = z.object({
  symbol:   z.string().min(1).max(20).transform((s) => s.toUpperCase()),
  qty:      z.number().positive(),
  costAvg:  z.number().positive(),
  currency: z.enum(["TWD", "USD"]),
});

export async function POST(req: Request) {
  const user = await getSessionUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  if (!user.canEdit) return new Response("Forbidden", { status: 403 });

  const parsed = Schema.safeParse(await req.json());
  if (!parsed.success) return new Response("Bad Request", { status: 400 });

  const { symbol, qty, costAvg, currency } = parsed.data;
  const holding = await prisma.holding.upsert({
    where: { householdId_symbol: { householdId: user.householdId, symbol } },
    create: { householdId: user.householdId, symbol, qty, costAvg, currency },
    update: { qty, costAvg, currency },
  });

  return Response.json({
    ok: true,
    holding: {
      id: holding.id,
      symbol: holding.symbol,
      qty: Number(holding.qty),
      costAvg: Number(holding.costAvg),
      currency: holding.currency,
    },
  });
}
