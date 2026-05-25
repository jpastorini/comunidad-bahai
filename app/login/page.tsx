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
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-gold-grad">
      {/* Estrellas decorativas de fondo */}
      <div className="pointer-events-none absolute -right-20 -top-24 opacity-[0.07]">
        <BahaiStar size={300} color="#fff" />
      </div>
      <div className="pointer-events-none absolute -bottom-28 -left-24 opacity-[0.06]">
        <BahaiStar size={340} color="#fff" />
      </div>

      <main className="relative flex flex-1 flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-md">
          {/* Marca y bienvenida */}
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
              <BahaiStar size={36} color="#fff" />
            </div>
            <div className="mb-2 text-[11px] font-semibold uppercase tracking-[2.5px] text-white/60">
              Tu comunidad, en un solo lugar
            </div>
            <h1 className="font-display text-[38px] font-bold leading-none text-white">
              Comunidad Bahá'í
            </h1>
            <p className="mx-auto mt-3 max-w-sm font-body text-[14px] leading-relaxed text-white/75">
              Mantenete conectado con la vida de tu comunidad local.
            </p>
          </div>

          {/* Tarjeta de acceso */}
          <div className="rounded-3xl bg-card p-6 shadow-[0_20px_50px_-12px_rgba(0,0,0,0.35)] md:p-8">
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
        </div>
      </main>
    </div>
  );
}
