import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import { supabase } from "@/lib/supabase";

export const Route = createFileRoute("/settings")({
  component: Settings,
});

type SubmitState = "idle" | "saving" | "saved" | "error";

function Settings() {
  const [status, setStatus] = useState<SubmitState>("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const password = form.get("password") as string;
    const confirm = form.get("confirm") as string;

    if (password !== confirm) {
      setStatus("error");
      setError("Passwords don't match.");
      return;
    }

    setStatus("saving");
    setError(null);
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setStatus("error");
      setError(error.message);
      return;
    }
    formEl.reset();
    setStatus("saved");
  }

  return (
    <DashboardShell title="Settings" subtitle="Manage your account.">
      <div className="max-w-md rounded-2xl border border-black/5 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-bold text-[#1c2024]">Change Password</h2>
        <form onSubmit={handleSubmit} className="mt-5 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-[#1c2024]">New Password</label>
            <input
              name="password"
              type="password"
              required
              minLength={8}
              className="w-full rounded-lg border border-black/10 bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-[#1c2024]">Confirm Password</label>
            <input
              name="confirm"
              type="password"
              required
              minLength={8}
              className="w-full rounded-lg border border-black/10 bg-white px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          {status === "error" && error && <p className="text-sm font-semibold text-red-600">{error}</p>}
          {status === "saved" && <p className="text-sm font-semibold text-[var(--color-primary)]">Password updated.</p>}
          <button
            type="submit"
            disabled={status === "saving"}
            className="rounded-full bg-[var(--color-primary)] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-transform hover:scale-105 disabled:opacity-60 disabled:hover:scale-100"
          >
            {status === "saving" ? "Saving…" : "Update Password"}
          </button>
        </form>
      </div>
    </DashboardShell>
  );
}
