import Link from "next/link";
import { SpendChart, UsageChart, type SpendRow } from "@/components/Charts";
import { Findings, Gauge, Leaders, Panel, Readout } from "@/components/ui";
import { store } from "@/lib/data";
import { groupAccounts, insightsFor, sortInsights, type Account } from "@/lib/insights";
import { TNB } from "@/lib/tariffs/tnb";
import { PROVIDERS } from "@/lib/types";
import { fmtDate, maskAccount, money } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function Overview() {
  const bills = await (await store()).list();
  if (!bills.length) return <Empty />;

  const accounts = groupAccounts(bills);
  const insights = sortInsights(accounts.flatMap((a) => insightsFor(a)));
  const latest = accounts.map((a) => a.bills[a.bills.length - 1]);
  const totalDue = latest.reduce((s, b) => s + b.totalDue, 0);
  const arrears = latest.reduce((s, b) => s + b.previousBalance, 0);
  const spend = spendByMonth(accounts);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <Panel title="Due now" meta={`${accounts.length} account${accounts.length > 1 ? "s" : ""}`}>
          <Readout label="Total payable" value={money(totalDue)} unit="RM" tone={arrears > 0 ? "red" : "amber"} size="lg" />
          <div className="mt-5">
            <Leaders
              rows={[
                ...latest.map((b) => ({ label: `${PROVIDERS[b.provider].name} · this period`, value: money(b.currentCharges) })),
                ...(arrears > 0 ? [{ label: "Unpaid from earlier bills", value: money(arrears) }] : []),
              ]}
            />
          </div>
        </Panel>
        <Panel title="Findings" meta={`${insights.length} item${insights.length === 1 ? "" : "s"}`} riseIndex={1}>
          <Findings insights={insights} />
        </Panel>
      </div>

      {accounts.length > 1 && spend.length > 1 && (
        <Panel title="Monthly spend" meta="Charges per month, excl. arrears" riseIndex={2}>
          <SpendChart data={spend} />
        </Panel>
      )}

      {accounts.map((a, i) => (
        <AccountPanel key={a.key} account={a} riseIndex={3 + i} />
      ))}
    </div>
  );
}

function AccountPanel({ account: a, riseIndex }: { account: Account; riseIndex: number }) {
  const b = a.bills[a.bills.length - 1];
  const unit = b.usage?.unit;
  // The line that matters: TNB's 600 kWh cliff, Air Selangor's top-rate tier.
  const line = a.provider === "tnb" ? TNB.protectionKwh : a.provider === "air_selangor" ? 35 : undefined;
  // Months flagged as an unusual spike, so the usage chart can call them out directly —
  // the whole point of tracking bills here is spotting what caused one.
  const spikeMonths = new Set(
    insightsFor(a)
      .filter((i) => i.id.endsWith(":spike"))
      .map((i) => a.bills.find((bill) => bill.id === i.billId)?.billDate.slice(0, 7))
      .filter((m): m is string => Boolean(m)),
  );
  return (
    <Panel
      title={
        <>
          {PROVIDERS[a.provider].name} <span className="text-muted">· {maskAccount(a.accountNo)}</span>
        </>
      }
      meta={`Last bill ${fmtDate(b.billDate)}`}
      riseIndex={riseIndex}
    >
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {b.usage && <Readout label="Usage" value={String(b.usage.value)} unit={b.usage.unit} />}
        <Readout label="This period" value={money(b.currentCharges)} unit="RM" />
        <Readout label="Carried over" value={money(b.previousBalance)} unit="RM" tone={b.previousBalance > 0 ? "red" : "ink"} />
        <Readout label={b.dueDate ? `Due ${fmtDate(b.dueDate)}` : "Total due"} value={money(b.totalDue)} unit="RM" />
      </div>

      {b.usage && line && (
        <div className="mt-6">
          <p className="label mb-2">
            This bill vs the {line} {b.usage.unit} line
          </p>
          <Gauge value={b.usage.value} line={line} unit={b.usage.unit} />
        </div>
      )}

      {unit && a.series.length > 1 && (
        <div className="mt-6">
          <p className="label mb-2">Monthly usage</p>
          <UsageChart data={a.series} unit={unit} threshold={line} spikeMonths={spikeMonths} />
        </div>
      )}

      <div className="mt-6">
        <p className="label mb-1">Uploaded bills</p>
        <ul className="divide-y divide-line">
          {[...a.bills].reverse().map((bill) => (
            <li key={bill.id}>
              <Link href={`/bills/${bill.id}`} className="num flex items-center justify-between gap-4 py-2.5 text-sm hover:text-amber-ink">
                <span>{fmtDate(bill.billDate)}</span>
                <span className="text-ink-2">
                  {bill.usage ? `${bill.usage.value} ${bill.usage.unit} · ` : ""}RM {money(bill.currentCharges)} →
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
}

function Empty() {
  return (
    <div className="mx-auto max-w-md border border-dashed border-line-2 bg-panel px-6 py-12 text-center">
      <p className="label">No readings yet</p>
      <h1 className="mt-2 text-xl font-medium">Add your first bill</h1>
      <p className="mt-2 text-sm text-ink-2">PDF e-bills from TNB, Air Selangor, Maxis or CelcomDigi.</p>
      <Link href="/upload" className="num mt-6 inline-block bg-amber px-4 py-2.5 text-xs font-medium tracking-wider text-black uppercase">
        Add bill
      </Link>
    </div>
  );
}

function spendByMonth(accounts: Account[]): SpendRow[] {
  const rows = new Map<string, SpendRow>();
  for (const a of accounts) {
    const cat = PROVIDERS[a.provider].category;
    if (cat === "other") continue;
    for (const p of a.series) {
      if (p.amount == null) continue;
      const row = rows.get(p.month) ?? { month: p.month };
      row[cat] = (row[cat] ?? 0) + p.amount;
      rows.set(p.month, row);
    }
  }
  return [...rows.values()].sort((a, b) => a.month.localeCompare(b.month)).slice(-12);
}
