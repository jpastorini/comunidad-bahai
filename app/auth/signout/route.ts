import { NextResponse } from "next/server";
import { createSupabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";

/**
 * Cierra sesión y redirige al login correspondiente:
 *  - /admin/* → /admin/login
 *  - cualquier otra cosa → /login
 */
export async function POST(request: Request) {
  if (isSupabaseConfigured()) {
    const supabase = createSupabaseServer();
    await supabase.auth.signOut();
  }
  const url = new URL(request.url);
  const referer = request.headers.get("referer") ?? "";
  const target = referer.includes("/admin") ? "/admin/login" : "/login";
  return NextResponse.redirect(new URL(target, url.origin), { status: 303 });
}
