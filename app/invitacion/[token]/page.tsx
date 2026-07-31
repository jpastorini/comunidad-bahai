import type { Metadata } from "next";
import Link from "next/link";
import { BahaiStar } from "@/components/BahaiStar";
import { getOptionalMember } from "@/lib/auth";
import { resolveInviteToken } from "@/lib/invites";

// Página PÚBLICA (sin login): es el link/QR que la Asamblea comparte.
// Diseñada para gente mayor: un solo mensaje, un solo botón grande.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Invitación — Comunidad Bahá'í",
};

export default async function InvitacionPage({
  params,
}: {
  params: { token: string };
}) {
  const invite = await resolveInviteToken(params.token);
  const session = invite ? await getOptionalMember() : null;

  return (
    <div className="relative flex min-h-[100dvh] flex-col overflow-hidden bg-gold-grad">
      <div className="pointer-events-none absolute -right-20 -top-24 opacity-[0.07]">
        <BahaiStar size={300} color="#fff" />
      </div>
      <div className="pointer-events-none absolute -bottom-28 -left-24 opacity-[0.06]">
        <BahaiStar size={340} color="#fff" />
      </div>

      <main className="relative flex flex-1 flex-col items-center justify-center px-5 py-10">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto mb-5 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
            <BahaiStar size={36} color="#fff" />
          </div>

          {!invite ? (
            <InvalidInvite />
          ) : (
            <ValidInvite
              token={params.token}
              localityName={invite.localityName}
              memberState={
                !session
                  ? "anonymous"
                  : session.locality?.id === invite.localityId
                    ? "same-locality"
                    : session.locality
                      ? "other-locality"
                      : "no-locality"
              }
            />
          )}
        </div>
      </main>
    </div>
  );
}

function InvalidInvite() {
  return (
    <>
      <h1 className="font-display text-[30px] font-bold leading-tight text-white">
        Este enlace ya no es válido
      </h1>
      <p className="mx-auto mt-3 max-w-sm font-body text-[15px] leading-relaxed text-white/80">
        Puede que la Asamblea haya generado uno nuevo. Pedile el enlace
        actualizado a alguien de tu comunidad.
      </p>
      <Link
        href="/login"
        className="tap mt-8 inline-block w-full rounded-2xl bg-white px-6 py-4 text-[16px] font-bold text-gold-dark shadow-[0_10px_30px_-8px_rgba(0,0,0,0.4)]"
      >
        Ir al inicio de sesión
      </Link>
    </>
  );
}

function ValidInvite({
  token,
  localityName,
  memberState,
}: {
  token: string;
  localityName: string;
  memberState: "anonymous" | "no-locality" | "same-locality" | "other-locality";
}) {
  if (memberState === "same-locality") {
    return (
      <>
        <h1 className="font-display text-[30px] font-bold leading-tight text-white">
          ¡Ya formás parte!
        </h1>
        <p className="mx-auto mt-3 max-w-sm font-body text-[15px] leading-relaxed text-white/80">
          Tu cuenta ya pertenece a la Comunidad Bahá'í de {localityName}.
        </p>
        <Link
          href="/"
          className="tap mt-8 inline-block w-full rounded-2xl bg-white px-6 py-4 text-[16px] font-bold text-gold-dark shadow-[0_10px_30px_-8px_rgba(0,0,0,0.4)]"
        >
          Abrir la app
        </Link>
      </>
    );
  }

  if (memberState === "other-locality") {
    return (
      <>
        <h1 className="font-display text-[30px] font-bold leading-tight text-white">
          Ya pertenecés a otra comunidad
        </h1>
        <p className="mx-auto mt-3 max-w-sm font-body text-[15px] leading-relaxed text-white/80">
          Esta invitación es de {localityName}, pero tu cuenta está en otra
          localidad. Si te mudaste, podés pedir el cambio desde tu perfil y
          la Asamblea de {localityName} lo aprueba.
        </p>
        <Link
          href="/seleccionar-localidad?change=1"
          className="tap mt-8 inline-block w-full rounded-2xl bg-white px-6 py-4 text-[16px] font-bold text-gold-dark shadow-[0_10px_30px_-8px_rgba(0,0,0,0.4)]"
        >
          Pedir cambio de comunidad
        </Link>
        <Link
          href="/"
          className="mt-4 inline-block text-[13px] font-medium text-white/80 underline"
        >
          Volver a mi app
        </Link>
      </>
    );
  }

  return (
    <>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[2.5px] text-white/60">
        Te damos la bienvenida
      </div>
      <h1 className="font-display text-[32px] font-bold leading-tight text-white">
        Comunidad Bahá'í de {localityName}
      </h1>
      <p className="mx-auto mt-4 max-w-sm font-body text-[15px] leading-relaxed text-white/85">
        Tu Asamblea te invita a la app de la comunidad: comunicados,
        calendario de Fiestas y actividades, fotos y más — todo en un
        solo lugar.
      </p>
      <a
        href={`/invitacion/${token}/comenzar`}
        className="tap mt-8 inline-block w-full rounded-2xl bg-white px-6 py-4 text-[17px] font-bold text-gold-dark shadow-[0_10px_30px_-8px_rgba(0,0,0,0.4)] active:scale-[0.98]"
      >
        Comenzar
      </a>
      <p className="mt-4 text-[12px] leading-relaxed text-white/65">
        {memberState === "anonymous"
          ? "En el próximo paso vas a entrar con tu cuenta de Google o tu correo. Te guiamos en todo."
          : "Con un toque quedás incorporado a tu comunidad."}
      </p>
    </>
  );
}
