import { BahaiStar } from "@/components/BahaiStar";
import { isSupabaseConfigured } from "@/lib/supabase/server";
import { MemberLoginForm } from "./login-form";

type SearchParams = {
  error?: string;
  next?: string;
};

const ERROR_COPY: Record<string, string> = {
  "no-supabase":
    "La aplicación aún no está conectada. Avísale a la Secretaría.",
  "no-profile":
    "No encontramos tu perfil. Pide a la Secretaría que verifique tu cuenta.",
  "callback-failed": "El enlace mágico expiró. Solicita uno nuevo.",
};

export default function MemberLoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const configured = isSupabaseConfigured();
  const error = searchParams.error ? ERROR_COPY[searchParams.error] : null;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-bg">
      <header className="relative overflow-hidden bg-gold-grad px-6 pb-12 pt-16">
        <div className="pointer-events-none absolute right-[-20px] top-6 opacity-[0.08]">
          <BahaiStar size={160} color="#fff" />
        </div>
        <div className="relative mx-auto max-w-md">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[2.5px] text-white/55">
            Centro de Comunicados
          </div>
          <h1 className="font-display text-[34px] font-bold leading-tight text-white">
            Comunidad Bahá'í
          </h1>
          <p className="mt-1 font-body text-[13px] text-white/70">
            Inicia sesión para escribir a la Secretaría y ofrecerte como
            voluntario.
          </p>
        </div>
      </header>

      <main className="-mt-6 flex-1 px-4 pb-12">
        <div className="mx-auto w-full max-w-md rounded-2xl bg-card p-6 shadow-card-elevated md:p-8">
          {error && (
            <div className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] text-rose-700">
              {error}
            </div>
          )}
          {!configured ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-800">
              <p className="font-semibold">App en modo demo</p>
              <p className="mt-1">
                Aún no hay conexión a Supabase. Pide a la Secretaría que
                complete la configuración para poder iniciar sesión.
              </p>
            </div>
          ) : (
            <MemberLoginForm next={searchParams.next} />
          )}

          <div className="mt-6 border-t border-black/[0.06] pt-4 text-center">
            <a
              href="/"
              className="text-[12px] font-medium text-muted hover:text-terra"
            >
              ← Volver al inicio
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
