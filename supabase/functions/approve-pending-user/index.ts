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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, { status: 405 });

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const supabaseAnonKey = Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceKey) {
    return json({ error: "Server misconfiguration" }, { status: 500 });
  }

  const authHeader = req.headers.get("Authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  let payload: { pendingUserId?: string; organizationId?: string; role?: string };
  try {
    payload = await req.json();
  } catch {
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
    return json(
      { error: "Missing or invalid parameters" },
      {
        status: 400,
      },
    );
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
    return json({ error: "Unauthorized" }, { status: 401 });
  }

  // Verify caller is an admin of the target org
  const { data: isAdmin, error: adminCheckError } = await supabaseAuthed.rpc("has_role", {
    _user_id: caller.id,
    _org_id: organizationId,
    _role: "admin",
  });

  if (adminCheckError) {
    return json({ error: adminCheckError.message }, { status: 400 });
  }

  if (!isAdmin) {
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

  if (pendingError) return json({ error: pendingError.message }, { status: 400 });
  if (!pendingUser) return json({ error: "Pending request not found" }, { status: 404 });
  if (pendingUser.status !== "pending") {
    return json({ error: "Request is not pending" }, { status: 400 });
  }

  const origin = req.headers.get("origin") ?? undefined;
  const redirectTo = origin ? `${origin}/login` : undefined;

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
    return json({ error: inviteError.message }, { status: 400 });
  }

  const newUserId = inviteData?.user?.id;
  if (!newUserId) {
    return json({ error: "Failed to create user" }, { status: 500 });
  }

  // Ensure profile exists so User Management can show the name
  await supabaseAdmin.from("profiles").upsert(
    {
      id: newUserId,
      full_name: pendingUser.full_name,
    },
    { onConflict: "id" },
  );

  const { error: roleInsertError } = await supabaseAdmin.from("user_roles").insert({
    user_id: newUserId,
    organization_id: organizationId,
    role,
  });

  if (roleInsertError) {
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
    return json({ error: pendingUpdateError.message }, { status: 400 });
  }

  return json({ userId: newUserId });
});
