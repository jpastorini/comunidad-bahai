import { NextResponse } from "next/server";
import { createSupabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";

/**
 * Cierra sesión y redirige a la puerta única de entrada: /login.
 */
export async function POST(request: Request) {
  if (isSupabaseConfigured()) {
    const supabase = createSupabaseServer();
    await supabase.auth.signOut();
  }
  const url = new URL(request.url);
  return NextResponse.redirect(new URL("/login", url.origin), { status: 303 });
}
