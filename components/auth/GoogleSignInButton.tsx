"use client";

import { useState } from "react";
import { createSupabaseBrowser } from "@/lib/supabase/client";

type Props = {
  /** Path donde redirigir post-login (ej. "/admin" o "/"). */
  next?: string;
};

/**
 * Botón "Continuar con Google" — inicia el flujo OAuth de Supabase.
 *
 * El flujo:
 *   1. Click → redirección a accounts.google.com
 *   2. Usuario aprueba → Google redirige a Supabase con code
 *   3. Supabase intercambia code por sesión, luego redirige a
 *      `${origin}/auth/callback` (que ya maneja localidad, rol, etc.)
 */
export function GoogleSignInButton({ next }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onClick() {
    setBusy(true);
    setError(null);

    const supabase = createSupabaseBrowser();
    const origin = window.location.origin;
    const safeNext = next && next.startsWith("/") ? next : "/";
    const callback = `${origin}/auth/callback`;
    const redirectTo =
      safeNext === "/" ? callback : `${callback}?next=${encodeURIComponent(safeNext)}`;

    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo },
    });

    if (oauthError) {
      setError(oauthError.message);
      setBusy(false);
    }
    // Si no hay error, el browser se redirige a Google y este componente
    // se desmonta — no hace falta setBusy(false).
  }

  return (
    <div>
      <button
        type="button"
        onClick={onClick}
        disabled={busy}
        className="tap flex w-full items-center justify-center gap-3 rounded-xl border border-black/10 bg-white px-4 py-3 text-[14px] font-semibold text-dark shadow-card-soft transition hover:border-black/20 disabled:cursor-not-allowed disabled:opacity-60"
      >
        <GoogleLogo />
        <span>{busy ? "Conectando…" : "Continuar con Google"}</span>
      </button>
      {error && (
        <p className="mt-2 text-[12px] text-rose-600">{error}</p>
      )}
    </div>
  );
}

function GoogleLogo() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M17.64 9.205c0-.639-.057-1.252-.164-1.841H9v3.481h4.844a4.14 4.14 0 0 1-1.796 2.716v2.259h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"
        fill="#4285F4"
      />
      <path
        d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"
        fill="#34A853"
      />
      <path
        d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"
        fill="#FBBC05"
      />
      <path
        d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"
        fill="#EA4335"
      />
    </svg>
  );
}
