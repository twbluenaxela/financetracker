import { requireUser } from "@/lib/auth";
import { InvestmentsView } from "@/app/investments/investments-view";

export default async function InvestmentsPage() {
  await requireUser();
  return <InvestmentsView />;
}
