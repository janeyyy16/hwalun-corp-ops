import { createFileRoute } from "@tanstack/react-router";
import { DashboardShell } from "@/components/DashboardShell";

export const Route = createFileRoute("/hr-recruitment")({
  component: HrRecruitment,
});

function HrRecruitment() {
  return (
    <DashboardShell title="HR & Recruitment" subtitle="Manage hiring pipelines and HR workflows.">
      <div className="rounded-2xl border border-black/5 bg-white p-8 shadow-sm">
        <p className="text-sm text-[var(--color-steel)]">
          The <strong className="text-[#1c2024]">HR & Recruitment</strong> module is coming soon.
        </p>
      </div>
    </DashboardShell>
  );
}
