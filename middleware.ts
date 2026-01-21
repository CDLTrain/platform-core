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
    // If they ARE a student, send them to the student app
    if (isStudent) {
      return NextResponse.redirect(new URL("/student", req.url));
    }
    // Otherwise they have no access yet
    return NextResponse.redirect(new URL("/no-access", req.url));
  }

  // Student routes/APIs require isStudent
  if (isStudentRoute(req) && !isStudent) {
    // If they ARE staff, send them to the staff app
    if (isStaff) {
      return NextResponse.redirect(new URL("/staff", req.url));
    }
    // Otherwise they have no access yet (not enrolled)
    return NextResponse.redirect(new URL("/no-access", req.url));
  }


  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
