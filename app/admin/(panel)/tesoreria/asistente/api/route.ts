import { NextResponse } from "next/server";
import { ensureTreasuryTag, requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { todayISO } from "@/lib/treasury-ledger";
import { treasuryYearForDate } from "@/lib/treasury-year";
import {
  MAX_TURNS_PER_DAY,
  applyDecision,
  ask,
  createThread,
  loadThread,
  resumeIfDecided,
  turnsToday,
  type AgentContext,
  type StreamEvent,
} from "@/lib/treasury-assistant/agent";
import { attachFiles, type UploadedFileInput } from "@/lib/treasury-assistant/files";

/**
 * POST /admin/tesoreria/asistente/api → una vuelta del asistente (090),
 * como un stream de líneas JSON (`StreamEvent`).
 *
 * Dos pedidos posibles:
 *   { threadId?, text, files? }                 una pregunta, con archivos ya
 *                                               subidos al bucket (092)
 *   { threadId, decide: { id, confirm } }       confirmar o descartar una propuesta
 *
 * Tag de Tesorería, como el Libro. La conversación vive en la base con la
 * RLS de la 090: solo la ve quien la tuvo.
 */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

type Body = {
  threadId?: string;
  text?: string;
  files?: UploadedFileInput[];
  decide?: { id?: string; confirm?: boolean };
};

const isSchemaMissing = (msg: string) =>
  /treasury_assistant|relation .* does not exist|PGRST205/.test(msg);

export async function POST(req: Request) {
  const session = await requireAdmin();
  ensureTreasuryTag(session.profile);
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: "Falta configurar ANTHROPIC_API_KEY." }, { status: 503 });
  }

  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Pedido inválido." }, { status: 400 });
  }
  const uploads = Array.isArray(body.files) ? body.files.filter((f) => f && typeof f.path === "string") : [];
  // Un archivo solo, sin texto, también es una pregunta.
  const text =
    (body.text ?? "").trim().slice(0, 4000) ||
    (uploads.length > 0 ? (uploads.length === 1 ? "Revisá este archivo." : "Revisá estos archivos.") : "");
  if (!text && !body.decide?.id) {
    return NextResponse.json({ error: "Escribí una pregunta." }, { status: 400 });
  }

  const supabase = createSupabaseServer();
  const today = todayISO();

  let thread;
  try {
    if (body.threadId) {
      thread = await loadThread(supabase, body.threadId);
      if (!thread) return NextResponse.json({ error: "La conversación no existe." }, { status: 404 });
    } else {
      if (!text) return NextResponse.json({ error: "Escribí una pregunta." }, { status: 400 });
      thread = await createThread(
        supabase,
        { localityId: session.locality.id, userId: session.user.id },
        titleFor(body.text?.trim() || "", uploads)
      );
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json(
      { error: isSchemaMissing(msg) ? "Falta aplicar la migración 090." : msg },
      { status: isSchemaMissing(msg) ? 503 : 500 }
    );
  }

  if (text && (await turnsToday(supabase, session.user.id)) >= MAX_TURNS_PER_DAY) {
    return NextResponse.json(
      { error: `Llegaste al tope de ${MAX_TURNS_PER_DAY} preguntas en 24 horas. Probá más tarde.` },
      { status: 429 }
    );
  }

  // La decisión se ejecuta acá, dentro del pedido: el action del Libro lee
  // la sesión de las cookies. Lo que sigue (el asistente contando cómo
  // quedó) va por el stream.
  let decided = null;
  if (body.decide?.id) {
    decided = await applyDecision(supabase, thread, body.decide.id, body.decide.confirm === true);
    if (!decided) return NextResponse.json({ error: "Esa propuesta ya no está pendiente." }, { status: 409 });
  }

  // Los archivos se atan a la conversación antes del stream: si la 092
  // falta o un path no es válido, el asistente lo cuenta en la respuesta.
  const attached = uploads.length > 0 && !body.decide?.id
    ? await attachFiles(supabase, { localityId: session.locality.id, userId: session.user.id, threadId: thread.id }, uploads)
    : { blocks: [], files: [] };

  const encoder = new TextEncoder();
  const current = thread;
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: StreamEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      const ctx: AgentContext = {
        supabase,
        localityId: session.locality.id,
        localityKind: session.locality.kind ?? "ael",
        localityName: session.locality.name,
        userId: session.user.id,
        userName: session.profile.full_name ?? null,
        today,
        bahaiYear: treasuryYearForDate(today),
        emit,
      };
      try {
        emit({ type: "thread", id: current.id, title: current.title });
        if (attached.files.length > 0) emit({ type: "files", files: attached.files });
        if (decided) {
          emit({ type: "proposal", proposal: decided });
          await resumeIfDecided(ctx, current);
        } else {
          await ask(ctx, current, text, attached.blocks);
        }
        emit({ type: "done" });
      } catch (e) {
        console.error("[treasury-assistant]", e);
        emit({
          type: "error",
          message: e instanceof Error ? e.message : "El asistente no pudo responder.",
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

function titleFor(text: string, uploads: UploadedFileInput[]): string {
  const base = text || (uploads[0] ? `Archivo: ${uploads[0].name}` : "Conversación");
  return base.length > 80 ? `${base.slice(0, 77)}…` : base;
}
