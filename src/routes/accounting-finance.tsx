import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell } from "@/components/DashboardShell";

export const Route = createFileRoute("/accounting-finance")({
  component: AccountingFinance,
});

function AccountingFinance() {
  return (
    <DashboardShell title="Accounting and Finance" subtitle="Track budgets, expenses, and financial reports.">
      <div className="rounded-2xl border border-black/5 bg-white p-8 shadow-sm">
        <p className="text-sm text-[var(--color-steel)]">
          The <strong className="text-[#1c2024]">Accounting and Finance</strong> module is coming soon.
        </p>
      </div>
    </DashboardShell>
  );
}
