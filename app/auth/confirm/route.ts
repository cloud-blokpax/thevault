import { type EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "edge";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") || "/auth/set-password";

  if (!token_hash || !type) {
    return NextResponse.redirect(
      new URL(
        "/auth/error?message=" +
          encodeURIComponent("Invalid invitation link"),
        request.url,
      ),
    );
  }

  const supabase = createClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash });

  if (error) {
    return NextResponse.redirect(
      new URL(
        "/auth/error?message=" +
          encodeURIComponent(error.message || "Invalid or expired link"),
        request.url,
      ),
    );
  }

  return NextResponse.redirect(new URL(next, request.url));
}
