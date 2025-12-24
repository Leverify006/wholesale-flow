/// <reference lib="deno.ns" />

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.89.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

serve(async (req) => {
  console.log("[approve-pending-user] Request received:", req.method);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    console.log("[approve-pending-user] Method not allowed:", req.method);
    return json({ error: "Method not allowed" }, { status: 405 });
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  // Try both possible env var names
  const supabaseAnonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  console.log("[approve-pending-user] Env check:", {
    hasUrl: !!supabaseUrl,
    hasAnonKey: !!supabaseAnonKey,
    hasServiceKey: !!supabaseServiceKey,
  });

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    console.error("[approve-pending-user] Missing environment variables");
    return json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    console.log("[approve-pending-user] Missing or invalid auth header");
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: { pendingUserId?: string; organizationId?: string; role?: string };
  try {
    payload = await req.json();
    console.log("[approve-pending-user] Payload:", payload);
  } catch (e) {
    console.error("[approve-pending-user] JSON parse error:", e);
    return json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const pendingUserId = payload.pendingUserId?.trim();
  const organizationId = payload.organizationId?.trim();
  const role = payload.role?.trim();

  const allowedRoles = new Set([
    "admin",
    "manager",
    "purchasing",
    "warehouse",
    "accounting",
    "viewer",
  ]);

  if (!pendingUserId || !organizationId || !role || !allowedRoles.has(role)) {
    console.log("[approve-pending-user] Invalid parameters:", { pendingUserId, organizationId, role });
    return json({ error: "Missing or invalid parameters" }, { status: 400 });
  }

  // Client with caller's JWT (for permission checks)
  const supabaseAuthed = createClient(supabaseUrl, supabaseAnonKey, {
    auth: { persistSession: false },
    global: {
      headers: {
        Authorization: authHeader,
      },
    },
  });

  const { data: userData, error: userError } = await supabaseAuthed.auth.getUser();
  const caller = userData?.user;
  if (userError || !caller) {
    console.log("[approve-pending-user] Auth getUser failed:", userError?.message);
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  console.log("[approve-pending-user] Caller:", caller.id);

  // Verify caller is an admin of the target org
  const { data: isAdmin, error: adminCheckError } = await supabaseAuthed.rpc("has_role", {
    _user_id: caller.id,
    _org_id: organizationId,
    _role: "admin",
  });

  console.log("[approve-pending-user] Admin check:", { isAdmin, adminCheckError: adminCheckError?.message });

  if (adminCheckError) {
    return json({ error: adminCheckError.message }, { status: 400 });
  }

  if (!isAdmin) {
    console.log("[approve-pending-user] Caller is not admin for org:", organizationId);
    return json({ error: "Forbidden" }, { status: 403 });
  }

  // Service client (for admin operations)
  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  const { data: pendingUser, error: pendingError } = await supabaseAdmin
    .from("pending_users")
    .select("id, email, full_name, status")
    .eq("id", pendingUserId)
    .maybeSingle();

  console.log("[approve-pending-user] Pending user lookup:", {
    found: !!pendingUser,
    status: pendingUser?.status,
    error: pendingError?.message,
  });

  if (pendingError) {
    return json({ error: pendingError.message }, { status: 400 });
  }
  if (!pendingUser) {
    return json({ error: "Pending request not found" }, { status: 404 });
  }
  if (pendingUser.status !== "pending") {
    return json({ error: "Request is not pending" }, { status: 400 });
  }

  const origin = req.headers.get("origin") ?? undefined;
  const redirectTo = origin ? `${origin}/login` : undefined;

  console.log("[approve-pending-user] Inviting user:", pendingUser.email);

  // Invite user (creates user + sends email to set password)
  const { data: inviteData, error: inviteError } = await supabaseAdmin.auth.admin.inviteUserByEmail(
    pendingUser.email,
    {
      data: {
        full_name: pendingUser.full_name,
        requested_role: role,
      },
      redirectTo,
    },
  );

  if (inviteError) {
    console.error("[approve-pending-user] Invite error:", inviteError.message);
    return json({ error: inviteError.message }, { status: 400 });
  }

  const newUserId = inviteData?.user?.id;
  console.log("[approve-pending-user] Invited user ID:", newUserId);

  if (!newUserId) {
    return json({ error: "Failed to create user" }, { status: 500 });
  }

  // Ensure profile exists so User Management can show the name
  const { error: profileError } = await supabaseAdmin.from("profiles").upsert(
    {
      id: newUserId,
      full_name: pendingUser.full_name,
    },
    { onConflict: "id" },
  );

  if (profileError) {
    console.error("[approve-pending-user] Profile upsert error:", profileError.message);
  }

  const { error: roleInsertError } = await supabaseAdmin.from("user_roles").insert({
    user_id: newUserId,
    organization_id: organizationId,
    role,
  });

  if (roleInsertError) {
    console.error("[approve-pending-user] Role insert error:", roleInsertError.message);
    return json({ error: roleInsertError.message }, { status: 400 });
  }

  const { error: pendingUpdateError } = await supabaseAdmin
    .from("pending_users")
    .update({
      status: "approved",
      reviewed_at: new Date().toISOString(),
      reviewed_by: caller.id,
      requested_role: role,
    })
    .eq("id", pendingUserId);

  if (pendingUpdateError) {
    console.error("[approve-pending-user] Pending update error:", pendingUpdateError.message);
    return json({ error: pendingUpdateError.message }, { status: 400 });
  }

  console.log("[approve-pending-user] Success! User approved:", newUserId);
  return json({ userId: newUserId });
});
