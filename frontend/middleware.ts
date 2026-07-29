import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { getSafeNextPath } from "@/lib/auth/redirect";
import { getSupabaseConfig } from "@/lib/supabase/config";

const AUTH_ENTRY_PATHS = [
  "/login",
  "/login/forgot-password",
  "/register",
];
const PASSWORD_UPDATE_PATH = "/login/reset-password";

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request });
  const { url, publishableKey } = getSupabaseConfig();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });
        response = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) => {
          response.cookies.set(name, value, options);
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const isAuthEntryPath = AUTH_ENTRY_PATHS.includes(
    request.nextUrl.pathname,
  );
  const isPasswordUpdatePath =
    request.nextUrl.pathname === PASSWORD_UPDATE_PATH;

  if (!user && !isAuthEntryPath) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.searchParams.set(
      "next",
      `${request.nextUrl.pathname}${request.nextUrl.search}`,
    );
    return NextResponse.redirect(loginUrl);
  }

  if (user && isAuthEntryPath && !isPasswordUpdatePath) {
    const dashboardUrl = request.nextUrl.clone();
    const nextPath = getSafeNextPath(
      request.nextUrl.searchParams.get("next"),
    );
    const safeDestination = new URL(nextPath, request.url);
    dashboardUrl.pathname = safeDestination.pathname;
    dashboardUrl.search = safeDestination.search;
    dashboardUrl.hash = safeDestination.hash;
    return NextResponse.redirect(dashboardUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/crm/:path*",
    "/chat/:path*",
    "/documents/:path*",
    "/reports/:path*",
    "/actions/:path*",
    "/settings/:path*",
    "/members/:path*",
    "/profile/:path*",
    "/login/:path*",
    "/register/:path*",
  ],
};
