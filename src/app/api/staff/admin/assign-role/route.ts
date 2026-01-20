export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import { createClient } from "@supabase/supabase-js";

type Role =
  | "SuperAdmin"
  | "FullAdmin"
  | "Admin"
  | "RegionalManager"
  | "GeneralManager"
  | "ProgramDirector"
  | "Instructor"
  | "Examiner"
  | "Student";

const VALID_ROLES: Set<string> = new Set([
  "SuperAdmin",
  "FullAdmin",
  "Admin",
  "RegionalManager",
  "GeneralManager",
  "ProgramDirector",
  "Instructor",
  "Examiner",
  "Student",
]);

function supabaseAdmin() {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
if (!userId) {
  return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
}
const form = await req.formData();
    const email = String(form.get("email") || "").trim().toLowerCase();
    const role = String(form.get("role") || "").trim() as Role;

    if (!email) return NextResponse.json({ ok: false, error: "Missing email" }, { status: 400 });
    if (!VALID_ROLES.has(role))
      return NextResponse.json({ ok: false, error: "Invalid role" }, { status: 400 });

    const tenantId = process.env.DEFAULT_TENANT_ID;
    if (!tenantId)
      return NextResponse.json({ ok: false, error: "Missing DEFAULT_TENANT_ID" }, { status: 500 });

    const sb = supabaseAdmin();
    const { data: me, error: meErr } = await sb
  .from("users")
  .select("id")
  .eq("clerk_user_id", userId)
  .single();

if (meErr || !me) {
  return NextResponse.json(
    { ok: false, error: "Your account is not synced to the registry yet." },
    { status: 403 }
  );
}

const { data: myRole, error: myRoleErr } = await sb
  .from("tenant_user_roles")
  .select("role")
  .eq("tenant_id", tenantId)
  .eq("user_id", me.id)
  .single();

if (myRoleErr || !myRole || myRole.role !== "SuperAdmin") {
  return NextResponse.json({ ok: false, error: "Forbidden" }, { status: 403 });
}


    // Find user by email
    const { data: user, error: userErr } = await sb
      .from("users")
      .select("id,email")
      .eq("email", email)
      .single();

    if (userErr || !user)
      return NextResponse.json(
        { ok: false, error: "User not found in registry (have they signed up in Clerk yet?)" },
        { status: 404 }
      );

    // Upsert role
    const { error: roleErr } = await sb
      .from("tenant_user_roles")
      .upsert({ tenant_id: tenantId, user_id: user.id, role }, { onConflict: "tenant_id,user_id" });

    if (roleErr)
      return NextResponse.json({ ok: false, error: "Role upsert failed" }, { status: 500 });

    return NextResponse.json({ ok: true, email, role });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ ok: false, error: "Server error" }, { status: 500 });
  }
}
