import { LoginForm } from "./login-form";
import { BahaiStar } from "@/components/BahaiStar";
import { isSupabaseConfigured } from "@/lib/supabase/server";

type SearchParams = {
  error?: string;
  redirectTo?: string;
};

const ERROR_COPY: Record<string, string> = {
  "no-supabase":
    "Supabase no está configurado. Define NEXT_PUBLIC_SUPABASE_URL y NEXT_PUBLIC_SUPABASE_ANON_KEY en .env.local.",
  "not-admin":
    "Tu cuenta no es Miembro de la Asamblea Local. Pide a un miembro de la Asamblea que te dé acceso.",
  "callback-failed":
    "No pudimos validar el enlace mágico. Solicita uno nuevo.",
};

export default function AdminLoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const configured = isSupabaseConfigured();
  const error = searchParams.error ? ERROR_COPY[searchParams.error] : null;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-bg">
      {/* Header dorado */}
      <header className="relative overflow-hidden bg-gold-grad px-6 pb-10 pt-16 md:pt-20">
        <div className="pointer-events-none absolute right-[-20px] top-6 opacity-[0.08]">
          <BahaiStar size={160} color="#fff" />
        </div>
        <div className="relative mx-auto max-w-md">
          <div className="mb-2 text-[10px] font-semibold uppercase tracking-[2.5px] text-white/55">
            Panel de Administración
          </div>
          <h1 className="font-display text-[34px] font-bold leading-tight text-white">
            Asamblea Local
          </h1>
          <p className="mt-1 font-body text-[13px] text-white/70">
            Acceso reservado a los miembros de la Asamblea Espiritual Local.
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
              <p className="font-semibold">Supabase no configurado</p>
              <p className="mt-1">
                Esta vista requiere variables de entorno reales. Edita{" "}
                <code className="rounded bg-amber-100 px-1 py-0.5">.env.local</code>{" "}
                con tus claves de Supabase y reinicia el servidor.
              </p>
            </div>
          ) : (
            <LoginForm redirectTo={searchParams.redirectTo} />
          )}

          <div className="mt-6 border-t border-black/[0.06] pt-4 text-center">
            <a
              href="/"
              className="text-[12px] font-medium text-muted hover:text-terra"
            >
              ← Volver a la app de miembros
            </a>
          </div>
        </div>
      </main>
    </div>
  );
}
