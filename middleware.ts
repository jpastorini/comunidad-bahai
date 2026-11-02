import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";
import { LEGAL } from "@/lib/legal";
import { OLD_HOSTS } from "@/lib/share-origin";

export async function middleware(request: NextRequest) {
  // El dominio viejo manda al nuevo con la misma ruta. /api queda afuera:
  // los avisos de Mercado Pago ya creados, el service worker de la PWA
  // vieja y los crons le pegan ahí, y un POST redirigido no siempre se sigue.
  const host = request.headers.get("host") ?? "";
  if (OLD_HOSTS.has(host) && !request.nextUrl.pathname.startsWith("/api/")) {
    const target = new URL(
      request.nextUrl.pathname + request.nextUrl.search,
      LEGAL.appUrl
    );
    return NextResponse.redirect(target, 308);
  }
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
