import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";

export type RoleKey = "super_admin" | "hr" | "admin" | "accounting_finance";

export interface Profile {
  id: string;
  full_name: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  address: string | null;
  start_date: string | null;
  date_of_birth: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  role: { key: RoleKey; label: string };
}

interface AuthContextValue {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  canManageEmployees: boolean;
  canManageUsers: boolean;
  canManageFinance: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const PROFILE_SELECT =
  "id, full_name, email, first_name, last_name, phone, address, start_date, date_of_birth, emergency_contact_name, emergency_contact_phone, role:roles(key, label)";

async function fetchProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase.from("profiles").select(PROFILE_SELECT).eq("id", userId).single();
  if (error || !data) return null;
  return data as unknown as Profile;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      if (data.session) setProfile(await fetchProfile(data.session.user.id));
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange(async (_event, newSession) => {
      setSession(newSession);
      setProfile(newSession ? await fetchProfile(newSession.user.id) : null);
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signOut() {
    await supabase.auth.signOut();
  }

  async function refreshProfile() {
    if (!session) return;
    setProfile(await fetchProfile(session.user.id));
  }

  const canManageEmployees = profile?.role.key === "super_admin" || profile?.role.key === "hr";
  const canManageUsers = canManageEmployees || profile?.role.key === "admin";
  const canManageFinance = profile?.role.key === "super_admin" || profile?.role.key === "accounting_finance";

  return (
    <AuthContext.Provider
      value={{ session, profile, loading, canManageEmployees, canManageUsers, canManageFinance, signIn, signOut, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
