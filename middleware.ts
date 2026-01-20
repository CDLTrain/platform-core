import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isStaffRoute = createRouteMatcher([
  "/staff(.*)",
  "/api/staff(.*)",
]);

const isStudentRoute = createRouteMatcher([
  "/student(.*)",
  "/api/student(.*)",
]);

export default clerkMiddleware(async (auth, req) => {
  const { userId, sessionClaims } = await auth();

  // If not signed in, block staff/student pages + APIs
  if (!userId) {
    if (isStaffRoute(req) || isStudentRoute(req)) {
      const signInUrl = new URL("/sign-in", req.url);
      signInUrl.searchParams.set("redirect_url", req.url);
      return NextResponse.redirect(signInUrl);
    }
    return NextResponse.next();
  }

  // Read flags from Clerk public metadata on the session token
  const publicMetadata = (sessionClaims?.publicMetadata as any) ?? {};
  const isStaff = publicMetadata?.isStaff === true;
  const isStudent = publicMetadata?.isStudent === true;

  // Staff routes/APIs require isStaff
  if (isStaffRoute(req) && !isStaff) {
    return NextResponse.redirect(new URL("/student", req.url));
  }

  // Student routes/APIs require isStudent
  if (isStudentRoute(req) && !isStudent) {
    return NextResponse.redirect(new URL("/staff", req.url));
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
