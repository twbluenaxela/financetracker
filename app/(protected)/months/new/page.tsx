import { MonthForm } from "@/app/months/month-form";

export default async function NewMonthPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string }>;
}) {
  const params = await searchParams;
  const today = new Date();
  const year = Number(params.year) || today.getFullYear();
  const month = Number(params.month) || today.getMonth() + 1;

  return (
    <>
      <MonthForm
        mode="create"
        initialValue={{
          year,
          month,
          income: 0,
          expense: 0,
          note: "",
          lines: [],
        }}
      />
    </>
  );
}
