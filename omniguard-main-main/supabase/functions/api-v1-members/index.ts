import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

async function auth(req: Request): Promise<{ valid: boolean; orgId?: string; userId?: string; role?: string }> {
  const h = req.headers.get("Authorization");
  if (!h?.startsWith("Bearer ")) return { valid: false };
  const token = h.slice(7);
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return { valid: false };
  const { data: membership } = await supabase.from("organization_members").select("organization_id, role").eq("user_id", user.id).eq("status", "active").order("created_at", { ascending: true }).limit(1).maybeSingle();
  return { valid: true, orgId: membership?.organization_id, userId: user.id, role: membership?.role };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  const a = await auth(req);
  if (!a.valid || !a.orgId) return json({ success: false, error: "UNAUTHORIZED" }, 401);
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/functions\/v1\/api-v1-members/, "");

  try {
    if (req.method === "GET" && (path === "" || path === "/")) {
      const { data, error } = await supabase.from("organization_members").select("*, user_profiles(id, email, first_name, last_name, avatar_url)").eq("organization_id", a.orgId).order("created_at", { ascending: true });
      if (error) throw error;
      return json({ success: true, data });
    }

    if (req.method === "POST" && (path === "" || path === "/")) {
      const body = await req.json();
      const email = String(body.email || "").trim().toLowerCase();
      const role = String(body.role || "developer");
      if (!email) return json({ success: false, error: "email required" }, 400);
      const { data: profile } = await supabase.from("user_profiles").select("id,email").eq("email", email).maybeSingle();
      if (!profile) return json({ success: false, error: "user not found" }, 404);
      const { data, error } = await supabase.from("organization_members").upsert({
        organization_id: a.orgId,
        user_id: profile.id,
        role,
        status: "active",
        invited_by: a.userId || null,
      }, { onConflict: "organization_id,user_id" }).select().single();
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        organization_id: a.orgId,
        user_id: a.userId || null,
        action: "member_invited",
        resource_type: "organization_member",
        resource_id: data.id,
        resource_name: email,
        metadata: { role },
      });
      return json({ success: true, data }, 201);
    }

    if (req.method === "PATCH" && (path === "" || path === "/")) {
      const body = await req.json();
      if (!body.id) return json({ success: false, error: "id required" }, 400);
      const updates: Record<string, unknown> = {};
      if (body.role) updates.role = body.role;
      if (body.status) updates.status = body.status;
      const { data, error } = await supabase.from("organization_members").update(updates).eq("organization_id", a.orgId).eq("id", body.id).select().single();
      if (error) throw error;
      return json({ success: true, data });
    }

    if (req.method === "DELETE" && (path === "" || path === "/")) {
      const body = await req.json();
      if (!body.id) return json({ success: false, error: "id required" }, 400);
      const { error } = await supabase.from("organization_members").delete().eq("organization_id", a.orgId).eq("id", body.id);
      if (error) throw error;
      return json({ success: true });
    }

    return json({ success: false, error: "Not found" }, 404);
  } catch (err) {
    return json({ success: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
