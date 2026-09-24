import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { DeleteButton } from "@/components/DeleteButton";
import { Findings, Gauge, Leaders, Panel, Readout } from "@/components/ui";
import { store } from "@/lib/data";
import { fmtDate, maskAccount, money } from "@/lib/format";
import { groupAccounts, insightsFor } from "@/lib/insights";
import { TNB } from "@/lib/tariffs/tnb";
import { PROVIDERS } from "@/lib/types";

export const dynamic = "force-dynamic";

async function deleteBill(id: string) {
  "use server";
  await (await store()).remove(id);
  redirect("/");
}

export default async function BillPage({ params }: PageProps<"/bills/[id]">) {
  const { id } = await params;
  const s = await store();
  const bill = await s.get(id);
  if (!bill) notFound();

  const account = groupAccounts(await s.list()).find((a) => a.provider === bill.provider && a.accountNo === bill.accountNo);
  const insights = account ? insightsFor(account).filter((i) => i.billId === bill.id) : [];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <Link href="/" className="label hover:text-ink-2">
          ← Overview
        </Link>
        <p className="num mt-3 text-xs text-muted">
          {PROVIDERS[bill.provider].name} · {maskAccount(bill.accountNo)}
          {bill.tariff ? ` · ${bill.tariff}` : ""}
        </p>
        <h1 className="mt-1 text-2xl font-medium sm:text-3xl">Bill of {fmtDate(bill.billDate)}</h1>
        {bill.periodStart && bill.periodEnd && (
          <p className="num mt-1 text-sm text-ink-2">
            {fmtDate(bill.periodStart)} → {fmtDate(bill.periodEnd)}
          </p>
        )}
      </div>

      <Panel title="Summary">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {bill.usage && <Readout label="Usage" value={String(bill.usage.value)} unit={bill.usage.unit} />}
          <Readout label="This period" value={money(bill.currentCharges)} unit="RM" />
          <Readout label="Carried over" value={money(bill.previousBalance)} unit="RM" tone={bill.previousBalance > 0 ? "red" : "ink"} />
          <Readout label={bill.dueDate ? `Due ${fmtDate(bill.dueDate)}` : "Total due"} value={money(bill.totalDue)} unit="RM" tone="amber" />
        </div>
        {bill.provider === "tnb" && bill.usage && (
          <div className="mt-6">
            <Gauge value={bill.usage.value} line={TNB.protectionKwh} unit={bill.usage.unit} />
          </div>
        )}
      </Panel>

      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        <Panel title="Charges" meta="RM">
          <Leaders
            rows={[
              ...bill.lineItems.map((l) => ({
                label: l.label,
                value: `${l.amount < 0 ? "−" : ""}${money(Math.abs(l.amount))}`,
                tone: l.amount < 0 ? ("ok" as const) : undefined,
              })),
              { label: "Current charges", value: money(bill.currentCharges), tone: "strong" as const },
            ]}
          />
        </Panel>
        <div className="space-y-4 sm:space-y-6">
          <Panel title="Findings">
            <Findings insights={insights} />
          </Panel>
          {bill.notices.length > 0 && (
            <Panel title="Printed on the bill">
              <ul className="space-y-2 text-sm text-ink-2">
                {bill.notices.map((n, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="num text-muted">—</span>
                    {n}
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>
      </div>

      <div className="flex justify-end border-t border-line pt-4">
        <DeleteButton action={deleteBill.bind(null, bill.id)} />
      </div>
    </div>
  );
}
