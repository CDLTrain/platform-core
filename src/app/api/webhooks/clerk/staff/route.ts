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
    // 1) Verify request is really from Clerk (Svix-signed)
    const secret = process.env.CLERK_STAFF_WEBHOOK_SECRET!;
    const payload = Buffer.from(await req.arrayBuffer()).toString("utf8");
    const headers = getSvixHeaders(req);

    const wh = new Webhook(secret);
    const evt = wh.verify(payload, headers) as any;

    const sb = supabaseAdmin();
    const eventType = evt.type;

    // Clerk user payload
    const user = evt.data as any;
    const clerkUserId: string = user.id;

    const primaryEmail: string | null =
      user.email_addresses?.find(
        (e: any) => e.id === user.primary_email_address_id
      )?.email_address ??
      user.email_addresses?.[0]?.email_address ??
      null;

    const fullName =
      user.first_name || user.last_name
        ? `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim()
        : null;

    // 2) Soft delete
    if (eventType === "user.deleted") {
      await sb
        .from("users")
        .update({ deleted_at: new Date().toISOString() })
        .eq("clerk_user_id", clerkUserId);

      return new Response("OK", { status: 200 });
    }

    // 3) Upsert user in registry DB
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

    // Invite-only model: do NOT assign a role automatically.
    return new Response("OK", { status: 200 });
  } catch (err) {
    console.error("Staff webhook error:", err);
    return new Response("Bad Request", { status: 400 });
  }
}
