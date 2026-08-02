import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { useAuth } from "@/lib/auth";
import logo from "@/assets/images/logo.png";

export const Route = createFileRoute("/login")({
  component: Login,
});

function Login() {
  const { signIn } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = form.get("email") as string;
    const password = form.get("password") as string;

    setLoading(true);
    setError(null);
    const { error } = await signIn(email, password);
    setLoading(false);
    if (error) setError(error);
  }

  return (
    // Fixed light-card-on-dark-backdrop brand look, intentionally not theme-aware (no toggle on this page).
    <div className="flex min-h-screen items-center justify-center bg-[#141618] px-6">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl">
        <img src={logo} alt="Hwa Lun Corporation" className="mb-6 h-9 w-auto" />
        <h1 className="font-display text-xl font-bold tracking-wide text-[#1c2024]">Sign In</h1>
        <p className="mt-1 text-sm text-[#5b6570]">Access the internal operations portal.</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-[#1c2024]">Email</label>
            <input
              name="email"
              type="email"
              required
              className="w-full rounded-lg border border-black/10 bg-white px-4 py-2.5 text-sm text-[#1c2024] outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-[#1c2024]">Password</label>
            <input
              name="password"
              type="password"
              required
              className="w-full rounded-lg border border-black/10 bg-white px-4 py-2.5 text-sm text-[#1c2024] outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          {error && <p className="text-sm font-semibold text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-full bg-[var(--color-primary)] px-6 py-3 text-sm font-bold text-white shadow-lg transition-transform hover:scale-105 disabled:opacity-60 disabled:hover:scale-100"
          >
            {loading ? "Signing in…" : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
