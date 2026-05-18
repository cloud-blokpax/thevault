import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(
          cookiesToSet: { name: string; value: string; options: CookieOptions }[],
        ) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const isLoginRoute = pathname.startsWith("/login");
  const isAuthFlowRoute = pathname.startsWith("/auth/");
  const isApiAuth = pathname.startsWith("/api/auth");
  const isPublicAsset =
    pathname.startsWith("/_next") ||
    pathname === "/manifest.webmanifest" ||
    pathname === "/sw.js" ||
    pathname.startsWith("/icons") ||
    pathname === "/favicon.ico";

  if (
    !user &&
    !isLoginRoute &&
    !isAuthFlowRoute &&
    !isApiAuth &&
    !isPublicAsset
  ) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // Force users with a temp password to set a new one before doing anything
  // else. Set-password page is allowed; everything outside /auth/* is not.
  const mustChangePassword =
    user?.user_metadata?.must_change_password === true;
  if (user && mustChangePassword && !isAuthFlowRoute && !isApiAuth) {
    const url = request.nextUrl.clone();
    url.pathname = "/auth/set-password";
    url.search = "";
    return NextResponse.redirect(url);
  }

  // Signed-in users hitting /login go to dashboard. We intentionally allow
  // /auth/set-password through so invited users with a fresh session can
  // finish setting their password.
  if (user && isLoginRoute && !mustChangePassword) {
    const url = request.nextUrl.clone();
    url.pathname = "/dashboard";
    url.search = "";
    return NextResponse.redirect(url);
  }

  return response;
}
