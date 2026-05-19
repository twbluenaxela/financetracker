import { requireUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { InvestmentsView } from "@/app/investments/investments-view";

export default async function InvestmentsPage() {
  const user = await requireUser();
  const rows = await prisma.holding.findMany({
    where: { householdId: user.householdId },
    orderBy: { createdAt: "asc" },
  });
  const holdings = rows.map((h) => ({
    id: h.id,
    symbol: h.symbol,
    qty: Number(h.qty),
    costAvg: Number(h.costAvg),
    currency: h.currency,
  }));
  return <InvestmentsView initialHoldings={holdings} />;
}
