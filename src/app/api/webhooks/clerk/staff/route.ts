export const runtime = "nodejs";
export const dynamic = "force-dynamic";
import { NextRequest } from "next/server";
import { Webhook } from "svix";
import { createClient } from "@supabase/supabase-js";

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function getSvixHeaders(req: NextRequest) {
  return {
    "svix-id": req.headers.get("svix-id") ?? "",
    "svix-timestamp": req.headers.get("svix-timestamp") ?? "",
    "svix-signature": req.headers.get("svix-signature") ?? "",
  };
}

export async function POST(req: NextRequest) {
  try {
    const secret = process.env.CLERK_STAFF_WEBHOOK_SECRET!;
    const payload = Buffer.from(await req.arrayBuffer()).toString("utf8");
    const headers = getSvixHeaders(req);

    console.log("DEBUG staff webhook:", {
  hasSecret: Boolean(process.env.CLERK_STAFF_WEBHOOK_SECRET),
  secretPrefix: (process.env.CLERK_STAFF_WEBHOOK_SECRET || "").slice(0, 6),
  svixId: headers["svix-id"] ? "present" : "missing",
  svixTimestamp: headers["svix-timestamp"] ? "present" : "missing",
  svixSignature: headers["svix-signature"] ? "present" : "missing",
});

    // Verify signature (rejects spoofed requests)
    const wh = new Webhook(secret);
    const evt = wh.verify(payload, headers) as any;

    const sb = supabaseAdmin();
    const eventType = evt.type;

    const user = evt.data as any;
    const clerkUserId: string = user.id;

    const primaryEmail: string | null =
      user.email_addresses?.find((e: any) => e.id === user.primary_email_address_id)
        ?.email_address ?? user.email_addresses?.[0]?.email_address ?? null;

    const fullName =
      user.first_name || user.last_name
        ? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim()
        : null;

    if (eventType === "user.deleted") {
      await sb
        .from("users")
        .update({ deleted_at: new Date().toISOString() })
        .eq("clerk_user_id", clerkUserId);

      return new Response("OK", { status: 200 });
    }

    const { data: upsertedUser, error: upsertErr } = await sb
      .from("users")
      .upsert(
        {
          clerk_user_id: clerkUserId,
          email: primaryEmail ?? `missing-email-${clerkUserId}@invalid.local`,
          full_name: fullName,
          user_type: "staff",
          deleted_at: null,
        },
        { onConflict: "clerk_user_id" }
      )
      .select("id")
      .single();

    if (upsertErr) throw upsertErr;

    const tenantName = process.env.DEFAULT_TENANT_NAME!;
    const { data: tenant, error: tenantErr } = await sb
      .from("tenants")
      .select("id")
      .eq("company_name", tenantName)
      .single();

    if (tenantErr) throw tenantErr;

    const role = process.env.DEFAULT_STAFF_ROLE || "SuperAdmin";
    await sb
      .from("tenant_user_roles")
      .upsert(
        { tenant_id: tenant.id, user_id: upsertedUser.id, role },
        { onConflict: "tenant_id,user_id" }
      );

    return new Response("OK", { status: 200 });
  } catch (err: any) {
  const msg =
    err?.message ||
    err?.toString?.() ||
    "unknown_error";

  console.error("Staff webhook error:", { message: msg });

  // TEMP: return message to diagnose (remove after fixed)
  return new Response(JSON.stringify({ ok: false, error: msg }), {
    status: 400,
    headers: { "content-type": "application/json" },
  });
}
}
