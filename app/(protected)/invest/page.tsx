import { prisma } from "@/lib/prisma";
import { InvestView } from "@/app/invest/invest-view";
import type { RiskLevel } from "@/lib/invest";

export default async function InvestPage() {
  const plan = await prisma.investmentPlan.findUnique({ where: { id: 1 } });

  return (
    <>
      <InvestView
        plan={{
          id: plan?.id ?? 1,
          startingCapital: Number(plan?.startingCapital ?? 0),
          monthlyContribution: Number(plan?.monthlyContribution ?? 0),
          targetAmount: Number(plan?.targetAmount ?? 0),
          twStockPct: plan?.twStockPct ?? 30,
          usStockPct: plan?.usStockPct ?? 40,
          bondPct: plan?.bondPct ?? 30,
          twStockReturn: Number(plan?.twStockReturn ?? 0.06),
          usStockReturn: Number(plan?.usStockReturn ?? 0.07),
          bondReturn: Number(plan?.bondReturn ?? 0.03),
          age: plan?.age ?? null,
          risk: (plan?.risk as RiskLevel) ?? "moderate",
        }}
      />
    </>
  );
}
