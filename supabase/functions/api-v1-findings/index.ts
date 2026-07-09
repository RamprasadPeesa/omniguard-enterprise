import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.45.0";
import { callAI, resolveAIConfigFromOrg } from "../_shared/ai.ts";

const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, PATCH, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, X-API-Key" };
const supa = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { autoRefreshToken: false, persistSession: false } });

async function verifyAuth(authHeader: string | null): Promise<{ valid: boolean; orgId?: string; userId?: string }> {
  if (!authHeader?.startsWith("Bearer ")) return { valid: false };
  const token = authHeader.slice(7);
  if (token.split(".").length === 3) {
    const { data: { user }, error } = await supa.auth.getUser(token);
    if (error || !user) return { valid: false };
    const { data: m } = await supa.from("organization_members").select("organization_id").eq("user_id", user.id).eq("status", "active").limit(1).maybeSingle();
    return { valid: true, orgId: m?.organization_id, userId: user.id };
  }
  if (token.startsWith("og_")) {
    const enc = new TextEncoder();
    const hash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", enc.encode(token)))).map(b => b.toString(16).padStart(2, "0")).join("");
    const { data: k } = await supa.from("api_keys").select("organization_id, expires_at").eq("key_hash", hash).eq("is_active", true).maybeSingle();
    if (!k) return { valid: false };
    if (k.expires_at && new Date(k.expires_at) < new Date()) return { valid: false };
    await supa.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("key_hash", hash);
    return { valid: true, orgId: k.organization_id };
  }
  return { valid: false };
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...cors, "Content-Type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: cors });
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/functions\/v1\/api-v1-findings/, "");
  const auth = await verifyAuth(req.headers.get("Authorization"));
  if (!auth.valid) return json({ success: false, error: { code: "UNAUTHORIZED" } }, 401);
  const orgId = auth.orgId!;

  try {
    // GET /findings
    if (req.method === "GET" && (path === "" || path === "/")) {
      const sev = url.searchParams.get("severity");
      const status = url.searchParams.get("status");
      const scanner = url.searchParams.get("scanner");
      const repoId = url.searchParams.get("repository_id");
      const limit = Math.min(parseInt(url.searchParams.get("limit") || "100"), 200);
      const offset = parseInt(url.searchParams.get("offset") || "0");
      let q = supa.from("findings").select("*", { count: "exact" }).eq("organization_id", orgId);
      if (sev) q = q.eq("severity", sev);
      if (status) q = q.eq("status", status);
      if (scanner) q = q.eq("scanner", scanner);
      if (repoId) q = q.eq("repository_id", repoId);
      const { data, count, error } = await q.order("risk_score", { ascending: false }).range(offset, offset + limit - 1);
      if (error) throw error;
      return json({ success: true, data, meta: { total: count, limit, offset } });
    }

    // GET /findings/:id
    const idMatch = path.match(/^\/([a-f0-9-]{36})$/);
    if (req.method === "GET" && idMatch) {
      const { data, error } = await supa.from("findings").select("*").eq("id", idMatch[1]).eq("organization_id", orgId).maybeSingle();
      if (error) throw error;
      if (!data) return json({ success: false, error: { code: "NOT_FOUND" } }, 404);
      return json({ success: true, data });
    }

    // PATCH /findings/:id
    const patchMatch = path.match(/^\/([a-f0-9-]{36})$/);
    if (req.method === "PATCH" && patchMatch) {
      const body = await req.json();
      const allowed = ["status", "assigned_to", "resolution_note"];
      const updates: Record<string, unknown> = {};
      for (const k of allowed) if (k in body) updates[k] = body[k];
      if (body.status === "resolved") { updates.resolved_by = auth.userId || null; updates.resolved_at = new Date().toISOString() }
      const { data, error } = await supa.from("findings").update(updates).eq("id", patchMatch[1]).eq("organization_id", orgId).select().single();
      if (error) throw error;
      await supa.from("audit_logs").insert({ organization_id: orgId, user_id: auth.userId || null, action: "finding_updated", resource_type: "finding", resource_id: patchMatch[1], metadata: updates });
      return json({ success: true, data });
    }

    // POST /findings/:id/suppress
    const suppMatch = path.match(/^\/([a-f0-9-]{36})\/suppress$/);
    if (req.method === "POST" && suppMatch) {
      const body = await req.json();
      if (!body.reason?.trim()) return json({ success: false, error: { code: "BAD_REQUEST", message: "reason required" } }, 400);
      const { data, error } = await supa.from("findings").update({ status: "suppressed", suppress_reason: body.reason, suppressed_by: auth.userId || null, suppressed_at: new Date().toISOString() }).eq("id", suppMatch[1]).eq("organization_id", orgId).select().single();
      if (error) throw error;
      if (!data) return json({ success: false, error: { code: "NOT_FOUND" } }, 404);
      const filePattern = data.file_path ? (data.file_path.split("/").slice(0, -1).join("/") || data.file_path) : "*";
      const { data: existingRule } = await supa.from("organization_suppression_rules")
        .select("id, dismiss_count")
        .eq("organization_id", orgId)
        .eq("scanner", data.scanner)
        .eq("rule_id", data.rule_id)
        .eq("file_pattern", filePattern)
        .maybeSingle();
      if (existingRule) {
        const dismissCount = Number(existingRule.dismiss_count ?? 1) + 1;
        await supa.from("organization_suppression_rules").update({
          dismiss_count: dismissCount,
          false_positive_likelihood: Math.min(0.95, 0.45 + dismissCount * 0.12),
          last_dismissed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          active: dismissCount >= 2,
        }).eq("id", existingRule.id);
      } else {
        await supa.from("organization_suppression_rules").insert({
          organization_id: orgId,
          scanner: data.scanner,
          rule_id: data.rule_id,
          file_pattern: filePattern,
          false_positive_likelihood: 0.45,
          dismiss_count: 1,
          active: false,
          generated_from_finding_id: data.id,
        });
      }
      await supa.from("audit_logs").insert({ organization_id: orgId, user_id: auth.userId || null, action: "finding_suppressed", resource_type: "finding", resource_id: suppMatch[1], metadata: { reason: body.reason } });
      return json({ success: true, data: { id: suppMatch[1], status: "suppressed" } });
    }

    // GET /findings/:id/ai-remediation
    const aiMatch = path.match(/^\/([a-f0-9-]{36})\/ai-remediation$/);
    if (req.method === "GET" && aiMatch) {
      const { data: finding } = await supa.from("findings").select("*").eq("id", aiMatch[1]).eq("organization_id", orgId).maybeSingle();
      if (!finding) return json({ success: false, error: { code: "NOT_FOUND" } }, 404);

      // If already has AI remediation, return it
      if (finding.ai_remediation) return json({ success: true, data: { ai_remediation: finding.ai_remediation, remediation: finding.remediation, model: finding.ai_model } });

      const aiConfig = await resolveAIConfigFromOrg(orgId);
      if (aiConfig.provider === "none") return json({ success: true, data: { ai_remediation: finding.remediation, remediation: finding.remediation } });

      const prompt = `Security expert. Provide a specific code fix for this ${finding.severity} vulnerability.

Finding: ${finding.title}
Rule: ${finding.rule_id}
Evidence: ${finding.evidence}
Location: ${finding.file_path}:${finding.line_start}
Description: ${finding.description}

Provide: 1) Why dangerous 2) Exact fix with code example 3) Verification steps. Max 400 words.`;

      const ai = await callAI(aiConfig, prompt, "medium", { orgId, maxTokens: 900 });
      const aiText = ai?.text || null;

      if (aiText) {
        await supa.from("findings").update({ ai_remediation: aiText, ai_provider: ai?.provider ?? aiConfig.provider, ai_model: ai?.model ?? "on-demand" }).eq("id", aiMatch[1]);
      }
      return json({ success: true, data: { ai_remediation: aiText, remediation: finding.remediation } });
    }

    return json({ success: false, error: { code: "NOT_FOUND" } }, 404);
  } catch (err) {
    console.error("api-v1-findings error:", err);
    return json({ success: false, error: { code: "INTERNAL_ERROR", message: err instanceof Error ? err.message : String(err) } }, 500);
  }
});
