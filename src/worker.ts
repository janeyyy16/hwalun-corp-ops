import { createClient } from "@supabase/supabase-js";

interface Fetcher {
  fetch(request: Request): Promise<Response>;
}

interface Env {
  ASSETS: Fetcher;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
}

const DEFAULT_PASSWORD = "hwalun2026!";
const MANAGER_ROLES = new Set(["super_admin", "hr"]);

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === "/api/employees" && request.method === "POST") {
      try {
        return await handleCreateEmployee(request, env);
      } catch (err) {
        console.error("create-employee failed:", err);
        return json({ error: err instanceof Error ? err.message : "Internal error" }, 500);
      }
    }

    return env.ASSETS.fetch(request);
  },
};

interface CreateEmployeeBody {
  full_name?: string;
  email?: string;
  role_id?: string;
}

async function handleCreateEmployee(request: Request, env: Env): Promise<Response> {
  const token = (request.headers.get("Authorization") ?? "").replace("Bearer ", "");
  if (!token) return json({ error: "Unauthorized" }, 401);

  const callerClient = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } },
  });

  const { data: userData, error: userError } = await callerClient.auth.getUser(token);
  if (userError || !userData.user) return json({ error: "Unauthorized" }, 401);

  const { data: callerProfile } = await callerClient
    .from("profiles")
    .select("role:roles(key)")
    .eq("id", userData.user.id)
    .single();

  const callerRoleKey = (callerProfile as unknown as { role: { key: string } | null } | null)?.role?.key;
  if (!callerRoleKey || !MANAGER_ROLES.has(callerRoleKey)) {
    return json({ error: "Forbidden" }, 403);
  }

  const body = (await request.json()) as CreateEmployeeBody;
  const { full_name, email, role_id } = body;
  if (!full_name || !email || !role_id) {
    return json({ error: "Missing required fields" }, 400);
  }

  const adminClient = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

  const { data: created, error: createError } = await adminClient.auth.admin.createUser({
    email,
    password: DEFAULT_PASSWORD,
    email_confirm: true,
  });
  if (createError || !created.user) {
    return json({ error: createError?.message ?? "Failed to create user" }, 400);
  }

  const { error: insertError } = await adminClient
    .from("profiles")
    .insert({ id: created.user.id, full_name, email, role_id });
  if (insertError) {
    return json({ error: insertError.message }, 400);
  }

  return json({ id: created.user.id, full_name, email, role_id }, 201);
}

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
