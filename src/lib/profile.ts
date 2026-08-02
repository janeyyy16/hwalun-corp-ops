import { supabase } from "@/lib/supabase";

export interface UpdateProfileInput {
  firstName: string;
  lastName: string;
  phone: string;
  address: string;
  dateOfBirth: string;
  emergencyContactName: string;
  emergencyContactPhone: string;
}

/**
 * Updates the caller's own basic profile info via the update_own_profile() RPC
 * — never touches role_id/email/start_date (start_date drives PTO tenure and
 * is only editable by super_admin/hr/admin, from User Management).
 */
export async function updateOwnProfile(input: UpdateProfileInput): Promise<void> {
  const { error } = await supabase.rpc("update_own_profile", {
    p_first_name: input.firstName.trim() || null,
    p_last_name: input.lastName.trim() || null,
    p_phone: input.phone.trim() || null,
    p_address: input.address.trim() || null,
    p_date_of_birth: input.dateOfBirth || null,
    p_emergency_contact_name: input.emergencyContactName.trim() || null,
    p_emergency_contact_phone: input.emergencyContactPhone.trim() || null,
  });
  if (error) throw new Error(error.message);
}

/** Verifies the current password by re-authenticating before setting the new one. */
export async function changePassword(email: string, oldPassword: string, newPassword: string): Promise<void> {
  const { error: verifyError } = await supabase.auth.signInWithPassword({ email, password: oldPassword });
  if (verifyError) throw new Error("Current password is incorrect.");

  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw new Error(error.message);
}
