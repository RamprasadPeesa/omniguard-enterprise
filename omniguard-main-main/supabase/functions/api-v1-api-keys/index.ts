import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-API-Key",
};

const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

async function sha256(text: string) {
  const hash = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2, "0")).join("");
}

async function auth(req: Request): Promise<{ valid: boolean; orgId?: string; userId?: string; role?: string }> {
  const h = req.headers.get("Authorization");
  if (!h?.startsWith("Bearer ")) return { valid: false };
  const token = h.slice(7);
  if (token.split(".").length !== 3) return { valid: false };
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
  const path = url.pathname.replace(/^\/functions\/v1\/api-v1-api-keys/, "");

  try {
    if (req.method === "GET" && (path === "" || path === "/")) {
      const { data, error } = await supabase.from("api_keys").select("*").eq("organization_id", a.orgId).order("created_at", { ascending: false });
      if (error) throw error;
      return json({ success: true, data });
    }

    if (req.method === "POST" && (path === "" || path === "/")) {
      const body = await req.json();
      const name = String(body.name || "").trim();
      const scopes = Array.isArray(body.scopes) ? body.scopes.filter(Boolean).map(String) : [];
      const expiresAt = body.expires_at ? new Date(body.expires_at).toISOString() : null;
      if (!name) return json({ success: false, error: "name required" }, 400);
      if (!scopes.length) return json({ success: false, error: "at least one scope required" }, 400);

      const rawKey = `og_${crypto.randomUUID().replace(/-/g, "")}${crypto.randomUUID().replace(/-/g, "")}`.slice(0, 48);
      const keyHash = await sha256(rawKey);
      const keyPrefix = rawKey.slice(0, 12);
      const { data, error } = await supabase.from("api_keys").insert({
        organization_id: a.orgId,
        name,
        key_prefix: keyPrefix,
        key_hash: keyHash,
        scopes,
        is_active: true,
        expires_at: expiresAt,
        created_by: a.userId || null,
      }).select().single();
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        organization_id: a.orgId,
        user_id: a.userId || null,
        action: "api_key_created",
        resource_type: "api_key",
        resource_id: data.id,
        resource_name: name,
        metadata: { scopes, expires_at: expiresAt },
      });
      return json({ success: true, data, raw_key: rawKey }, 201);
    }

    if (req.method === "PATCH" && (path === "" || path === "/")) {
      const body = await req.json();
      if (!body.id) return json({ success: false, error: "id required" }, 400);
      const updates: Record<string, unknown> = {};
      for (const key of ["name", "is_active", "expires_at", "scopes"]) {
        if (body[key] !== undefined) updates[key] = body[key];
      }
      const { data, error } = await supabase.from("api_keys").update(updates).eq("organization_id", a.orgId).eq("id", body.id).select().single();
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        organization_id: a.orgId,
        user_id: a.userId || null,
        action: "api_key_updated",
        resource_type: "api_key",
        resource_id: body.id,
        resource_name: data.name,
        metadata: updates,
      });
      return json({ success: true, data });
    }

    if (req.method === "DELETE" && (path === "" || path === "/")) {
      const body = await req.json();
      if (!body.id) return json({ success: false, error: "id required" }, 400);
      const { error } = await supabase.from("api_keys").update({ is_active: false }).eq("organization_id", a.orgId).eq("id", body.id);
      if (error) throw error;
      await supabase.from("audit_logs").insert({
        organization_id: a.orgId,
        user_id: a.userId || null,
        action: "api_key_revoked",
        resource_type: "api_key",
        resource_id: body.id,
        metadata: {},
      });
      return json({ success: true });
    }

    return json({ success: false, error: "Not found" }, 404);
  } catch (err) {
    return json({ success: false, error: err instanceof Error ? err.message : String(err) }, 500);
  }
});
