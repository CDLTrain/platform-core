import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isAdminRoute = createRouteMatcher([
  "/admin(.*)",
  "/api/admin(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  if (isAdminRoute(req)) {
    const { userId } = await auth();

   if (!userId) {
  const signInUrl = new URL("/sign-in", req.url);
  signInUrl.searchParams.set("redirect_url", req.url);
  return NextResponse.redirect(signInUrl);
    }
  }
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
