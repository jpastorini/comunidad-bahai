import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, sw.js, manifest.webmanifest, icon files
     * - public assets (icons, images, fonts)
     * - API routes used by service worker
     */
    "/((?!_next/static|_next/image|favicon.ico|sw.js|swe-worker-.*|workbox-.*|manifest.webmanifest|icons/|icon.svg).*)",
  ],
};
