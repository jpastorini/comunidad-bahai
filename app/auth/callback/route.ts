import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * Magic-link callback. Supabase redirects here with `?code=...`; we exchange
 * it for a session and forward to the originally-requested page (or to a
 * sensible default based on the user's role).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const nextParam = url.searchParams.get("next");

  if (code) {
    const supabase = createSupabaseServer();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Honor explicit `next` if present, otherwise route by role.
      if (nextParam && nextParam.startsWith("/")) {
        return NextResponse.redirect(new URL(nextParam, url.origin));
      }
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", user.id)
          .maybeSingle();
        const target = profile?.role === "admin" ? "/admin" : "/";
        return NextResponse.redirect(new URL(target, url.origin));
      }
      return NextResponse.redirect(new URL("/", url.origin));
    }
  }

  return NextResponse.redirect(
    new URL("/login?error=callback-failed", url.origin)
  );
}
