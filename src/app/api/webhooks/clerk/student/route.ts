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
    const evt = await verifyWebhook(req, {
      signingSecret: process.env.CLERK_STUDENT_WEBHOOK_SECRET,
    });

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
          user_type: "student",
          deleted_at: null,
        },
        { onConflict: "clerk_user_id" }
      )
      .select("id")
      .single();

    if (upsertErr) throw upsertErr;

    // For now, attach students to your default tenant.
    // Later, we’ll assign students to the correct tenant via invite/enrollment flow.
    const tenantName = process.env.DEFAULT_TENANT_NAME!;
    const { data: tenant, error: tenantErr } = await sb
      .from("tenants")
      .select("id")
      .eq("company_name", tenantName)
      .single();

    if (tenantErr) throw tenantErr;

    await sb
      .from("tenant_user_roles")
      .upsert(
        { tenant_id: tenant.id, user_id: upsertedUser.id, role: "Student" },
        { onConflict: "tenant_id,user_id" }
      );

    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("Student webhook error:", err);
    return new Response("Bad Request", { status: 400 });
  }
}
