import { NextResponse } from "next/server";
import { createSupabaseServer, isSupabaseConfigured } from "@/lib/supabase/server";

export async function POST(request: Request) {
  if (isSupabaseConfigured()) {
    const supabase = createSupabaseServer();
    await supabase.auth.signOut();
  }
  const url = new URL(request.url);
  return NextResponse.redirect(new URL("/admin/login", url.origin), {
    status: 303,
  });
}
