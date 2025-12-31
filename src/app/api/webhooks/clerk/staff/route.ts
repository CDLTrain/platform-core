import { NextResponse } from "next/server";

export async function POST(req: Request) {
  // Temporary: just acknowledge receipt so Clerk stops retrying.
  // Step 20 will add signature verification + Supabase sync.
  const body = await req.text();

  console.log("Clerk webhook received:", {
    path: new URL(req.url).pathname,
    length: body.length,
  });

  return NextResponse.json({ ok: true });
}
