import { createFileRoute } from "@tanstack/react-router";
import { useState, type FormEvent } from "react";
import { DashboardShell } from "@/components/DashboardShell";
import { useAuth } from "@/lib/auth";
import { changePassword, updateOwnProfile } from "@/lib/profile";

export const Route = createFileRoute("/settings")({
  component: Settings,
});

type SubmitState = "idle" | "saving" | "saved" | "error";

function Settings() {
  const { profile, refreshProfile } = useAuth();
  const [profileStatus, setProfileStatus] = useState<SubmitState>("idle");
  const [profileError, setProfileError] = useState<string | null>(null);
  const [passwordStatus, setPasswordStatus] = useState<SubmitState>("idle");
  const [passwordError, setPasswordError] = useState<string | null>(null);

  if (!profile) return null;

  async function handleProfileSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    setProfileStatus("saving");
    setProfileError(null);
    try {
      await updateOwnProfile({
        firstName: (form.get("first_name") as string) || "",
        lastName: (form.get("last_name") as string) || "",
        phone: (form.get("phone") as string) || "",
        address: (form.get("address") as string) || "",
        dateOfBirth: (form.get("date_of_birth") as string) || "",
        emergencyContactName: (form.get("emergency_contact_name") as string) || "",
        emergencyContactPhone: (form.get("emergency_contact_phone") as string) || "",
      });
      await refreshProfile();
      setProfileStatus("saved");
    } catch (err) {
      setProfileStatus("error");
      setProfileError(err instanceof Error ? err.message : "Failed to save profile.");
    }
  }

  async function handlePasswordSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const formEl = e.currentTarget;
    const form = new FormData(formEl);
    const oldPassword = form.get("old_password") as string;
    const newPassword = form.get("password") as string;
    const confirm = form.get("confirm") as string;

    if (newPassword !== confirm) {
      setPasswordStatus("error");
      setPasswordError("Passwords don't match.");
      return;
    }

    setPasswordStatus("saving");
    setPasswordError(null);
    try {
      await changePassword(profile!.email, oldPassword, newPassword);
      formEl.reset();
      setPasswordStatus("saved");
    } catch (err) {
      setPasswordStatus("error");
      setPasswordError(err instanceof Error ? err.message : "Failed to update password.");
    }
  }

  return (
    <DashboardShell title="Profile Settings" subtitle="Manage your personal information and account.">
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
          <h2 className="text-lg font-bold text-ink">Personal Information</h2>
          <form onSubmit={handleProfileSubmit} className="mt-5 grid gap-4 sm:grid-cols-2">
            <Field label="First Name" name="first_name" defaultValue={profile.first_name ?? ""} />
            <Field label="Last Name" name="last_name" defaultValue={profile.last_name ?? ""} />
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-semibold text-ink">Email</label>
              <input
                value={profile.email}
                disabled
                className="w-full cursor-not-allowed rounded-lg border border-line-strong bg-subtle px-4 py-2.5 text-sm text-[var(--color-steel)] outline-none"
              />
            </div>
            <Field label="Phone" name="phone" type="tel" defaultValue={profile.phone ?? ""} />
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-ink">Start Date</label>
              <input
                type="date"
                value={profile.start_date ?? ""}
                disabled
                title="Set by HR, Admin, or Super Admin in User Management"
                className="w-full cursor-not-allowed rounded-lg border border-line-strong bg-subtle px-4 py-2.5 text-sm text-[var(--color-steel)] outline-none"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1.5 block text-sm font-semibold text-ink">Address</label>
              <input
                name="address"
                defaultValue={profile.address ?? ""}
                className="w-full rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <Field label="Date of Birth" name="date_of_birth" type="date" defaultValue={profile.date_of_birth ?? ""} />
            <div />
            <Field label="Emergency Contact Name" name="emergency_contact_name" defaultValue={profile.emergency_contact_name ?? ""} />
            <Field
              label="Emergency Contact Phone"
              name="emergency_contact_phone"
              type="tel"
              defaultValue={profile.emergency_contact_phone ?? ""}
            />
            {profileStatus === "error" && profileError && (
              <p className="text-sm font-semibold text-red-600 sm:col-span-2">{profileError}</p>
            )}
            {profileStatus === "saved" && (
              <p className="text-sm font-semibold text-[var(--color-primary)] sm:col-span-2">Profile updated.</p>
            )}
            <button
              type="submit"
              disabled={profileStatus === "saving"}
              className="rounded-full bg-[var(--color-primary)] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-transform hover:scale-105 disabled:opacity-60 disabled:hover:scale-100 sm:col-span-2 sm:w-fit"
            >
              {profileStatus === "saving" ? "Saving…" : "Save Changes"}
            </button>
          </form>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-6 shadow-sm">
          <h2 className="text-lg font-bold text-ink">Change Password</h2>
          <form onSubmit={handlePasswordSubmit} className="mt-5 space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-ink">Old Password</label>
              <input
                name="old_password"
                type="password"
                required
                className="w-full rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-ink">New Password</label>
              <input
                name="password"
                type="password"
                required
                minLength={8}
                className="w-full rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-ink">Confirm New Password</label>
              <input
                name="confirm"
                type="password"
                required
                minLength={8}
                className="w-full rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            {passwordStatus === "error" && passwordError && <p className="text-sm font-semibold text-red-600">{passwordError}</p>}
            {passwordStatus === "saved" && <p className="text-sm font-semibold text-[var(--color-primary)]">Password updated.</p>}
            <button
              type="submit"
              disabled={passwordStatus === "saving"}
              className="rounded-full bg-[var(--color-primary)] px-6 py-2.5 text-sm font-bold text-white shadow-sm transition-transform hover:scale-105 disabled:opacity-60 disabled:hover:scale-100"
            >
              {passwordStatus === "saving" ? "Saving…" : "Update Password"}
            </button>
          </form>
        </div>
      </div>
    </DashboardShell>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-ink">{label}</label>
      <input
        name={name}
        type={type}
        defaultValue={defaultValue}
        className="w-full rounded-lg border border-line-strong bg-surface px-4 py-2.5 text-sm outline-none focus:border-[var(--color-primary)]"
      />
    </div>
  );
}
