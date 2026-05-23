"use client";

import { useState } from "react";
import { GoogleSignInButton } from "@/components/auth/GoogleSignInButton";
import { createSupabaseBrowser } from "@/lib/supabase/client";

type Props = { next?: string };

export function MemberLoginForm({ next }: Props) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "sent" | "error">(
    "idle"
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setStatus("sending");
    setErrorMsg(null);

    const supabase = createSupabaseBrowser();
    const origin = window.location.origin;
    // Always use the exact registered redirect URL (no query params on it).
    // The desired post-login destination travels through Supabase as a
    // cookie/hash and is read by /auth/callback via `next` search param.
    const safeNext = next && next.startsWith("/") ? next : "/";
    const callback = `${origin}/auth/callback`;
    // We append `?next=` to the callback hint via supabase's redirectTo
    // hash params — Supabase preserves the query string after the callback.
    // If your Supabase project rejects query strings on the redirect URL,
    // remove the query and rely on the default redirect inside /auth/callback.
    const redirectUrl = safeNext === "/"
      ? callback
      : `${callback}?next=${encodeURIComponent(safeNext)}`;

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectUrl },
    });

    if (error) {
      setStatus("error");
      setErrorMsg(error.message);
      return;
    }
    setStatus("sent");
  }

  if (status === "sent") {
    return (
      <div className="text-center">
        <div className="mb-3 inline-flex h-12 w-12 items-center justify-center rounded-full bg-terra/10 text-terra">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 className="font-display text-[22px] font-semibold text-dark">
          Revisa tu correo
        </h2>
        <p className="mt-2 font-body text-[13px] text-muted">
          Enviamos un enlace mágico a{" "}
          <span className="font-semibold text-dark">{email}</span>. Ábrelo en
          este dispositivo para entrar.
        </p>
        <button
          type="button"
          onClick={() => setStatus("idle")}
          className="mt-5 text-[12px] font-medium text-terra hover:underline"
        >
          Usar otro correo
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-[22px] font-semibold text-dark">
          Iniciar sesión
        </h2>
        <p className="mt-1 font-body text-[13px] text-muted">
          La forma más rápida es con tu cuenta de Google. También podés usar
          tu email y te mandamos un enlace mágico.
        </p>
      </div>

      <GoogleSignInButton next={next} />

      <div className="flex items-center gap-3 text-[11px] uppercase tracking-wide text-muted">
        <span className="h-px flex-1 bg-black/[0.08]" />
        <span>o usar email</span>
        <span className="h-px flex-1 bg-black/[0.08]" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label
            htmlFor="email"
            className="mb-1 block text-[12px] font-semibold text-dark"
          >
            Correo electrónico
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="tu@correo.com"
            className="w-full rounded-xl border border-black/10 bg-bg px-4 py-3 text-[14px] text-dark outline-none placeholder:text-muted focus:border-terra"
          />
        </div>

        {errorMsg && <p className="text-[12px] text-rose-600">{errorMsg}</p>}

        <button
          type="submit"
          disabled={status === "sending"}
          className="tap w-full rounded-xl border border-terra/30 bg-terra/[0.05] px-4 py-3 text-[14px] font-semibold text-terra shadow-card-soft transition disabled:cursor-not-allowed disabled:opacity-60 hover:bg-terra/10"
        >
          {status === "sending" ? "Enviando..." : "Enviar enlace mágico"}
        </button>
      </form>
    </div>
  );
}
