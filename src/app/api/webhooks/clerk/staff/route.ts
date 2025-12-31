import { NextRequest } from "next/server";
import { verifyWebhook } from "@clerk/nextjs/webhooks";
import { createClient } from "@supabase/supabase-js";

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(req: NextRequest) {
  try {
    // Verify webhook signature (prevents fake calls)
    const evt = await verifyWebhook(req, {
      signingSecret: process.env.CLERK_STAFF_WEBHOOK_SECRET,
    });

    const sb = supabaseAdmin();
    const eventType = evt.type;

    // Clerk User object for user.* events
    const user = evt.data as any;
    const clerkUserId: string = user.id;
    const primaryEmail: string | null =
      user.email_addresses?.find((e: any) => e.id === user.primary_email_address_id)
        ?.email_address ?? user.email_addresses?.[0]?.email_address ?? null;

    const fullName =
      user.first_name || user.last_name
        ? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim()
        : null;

    // Soft-delete on user.deleted
    if (eventType === "user.deleted") {
      await sb
        .from("users")
        .update({ deleted_at: new Date().toISOString() })
        .eq("clerk_user_id", clerkUserId);

      return new Response("OK", { status: 200 });
    }

    // Upsert user row (create or update)
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

    // Find your default tenant by name
    const tenantName = process.env.DEFAULT_TENANT_NAME!;
    const { data: tenant, error: tenantErr } = await sb
      .from("tenants")
      .select("id")
      .eq("company_name", tenantName)
      .single();

    if (tenantErr) throw tenantErr;

    // Assign default staff role to that tenant (first bootstrap)
    const role = process.env.DEFAULT_STAFF_ROLE || "SuperAdmin";
    await sb
      .from("tenant_user_roles")
      .upsert(
        { tenant_id: tenant.id, user_id: upsertedUser.id, role },
        { onConflict: "tenant_id,user_id" }
      );

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("Staff webhook error:", err);
    return new Response("Bad Request", { status: 400 });
  }
}
