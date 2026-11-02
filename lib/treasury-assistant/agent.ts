import "server-only";
import type Anthropic from "@anthropic-ai/sdk";
import type { SupabaseClient } from "@supabase/supabase-js";
import { TOOLS, TOOL_LABELS, runTool, type Proposal, type ToolContext } from "./tools";
import { executeProposal } from "./execute";
import { FILES_BETA, anthropic } from "./client";
import { parseFileNote } from "./files";
import { SYSTEM_PROMPT, contextBlock } from "./prompt";
import type { AttachedFile, DisplayItem, StreamEvent } from "./types";

export type { StreamEvent } from "./types";

/**
 * El bucle del asistente de Tesorería (090).
 *
 * Cada pregunta corre el bucle de herramientas: el modelo pide datos, el
 * servidor los trae con el cliente del tesorero (la RLS manda), y así
 * hasta que contesta. Cuando pide una ESCRITURA, el bucle se detiene: la
 * propuesta queda en `pending`, la pantalla la muestra, y recién cuando el
 * tesorero decide cada una se ejecuta y el bucle sigue con el resultado.
 *
 * El historial se guarda entero en la base (`messages`), tal cual lo
 * devuelve la API: los bloques de pensamiento tienen que volver sin
 * cambios en el pedido siguiente.
 */

const MODEL = "claude-opus-5-5";
/** Vueltas de herramientas por pregunta: un tope contra un bucle, no un límite normal. */
const MAX_STEPS = 14;
export const MAX_TURNS_PER_DAY = 80;

type Msg = Anthropic.Beta.BetaMessageParam;
type ToolResult = Anthropic.Beta.BetaToolResultBlockParam;

export type Pending = {
  /** Todos los tool_use del último mensaje del asistente, en orden. */
  toolUseIds: string[];
  /** Los que ya tienen resultado (las lecturas que corrieron al lado). */
  results: Record<string, ToolResult>;
  proposals: Proposal[];
};

export type Thread = {
  id: string;
  title: string | null;
  messages: Msg[];
  pending: Pending | null;
  /** Tarjetas ya resueltas y después de qué mensaje del historial van. */
  decided: Array<{ at: number; proposals: Proposal[] }>;
  input_tokens: number;
  output_tokens: number;
};

const THREAD_FIELDS = "id, title, messages, pending, decided, input_tokens, output_tokens";

export type AgentContext = ToolContext & {
  localityName: string;
  userName: string | null;
  bahaiYear: number | null;
  emit: (e: StreamEvent) => void;
};

// ─── Persistencia ──────────────────────────────────────────────────────

export async function loadThread(supabase: SupabaseClient, id: string): Promise<Thread | null> {
  const { data } = await supabase
    .from("treasury_assistant_threads")
    .select(THREAD_FIELDS)
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const row = data as Thread;
  return {
    ...row,
    messages: Array.isArray(row.messages) ? row.messages : [],
    decided: Array.isArray(row.decided) ? row.decided : [],
    input_tokens: Number(row.input_tokens) || 0,
    output_tokens: Number(row.output_tokens) || 0,
  };
}

export async function createThread(
  supabase: SupabaseClient,
  ctx: { localityId: string; userId: string },
  title: string
): Promise<Thread> {
  const { data, error } = await supabase
    .from("treasury_assistant_threads")
    .insert({ locality_id: ctx.localityId, profile_id: ctx.userId, title })
    .select(THREAD_FIELDS)
    .single();
  if (error) throw new Error(error.message);
  return { ...(data as Thread), messages: [], pending: null, decided: [], input_tokens: 0, output_tokens: 0 };
}

export type ThreadSummary = { id: string; title: string | null; updated_at: string };

/** Las conversaciones de la persona en esta comunidad (la RLS acota). */
export async function listThreads(supabase: SupabaseClient, limit = 30): Promise<ThreadSummary[] | null> {
  const { data, error } = await supabase
    .from("treasury_assistant_threads")
    .select("id, title, updated_at")
    .order("updated_at", { ascending: false })
    .limit(limit);
  if (error) return null;
  return (data ?? []) as ThreadSummary[];
}

/**
 * La conversación como la dibuja la pantalla: las preguntas, el texto del
 * asistente (varias vueltas de herramientas seguidas se juntan en una
 * respuesta) y las tarjetas, ya resueltas o pendientes, donde ocurrieron.
 */
export function toDisplay(t: Thread): DisplayItem[] {
  const items: DisplayItem[] = [];
  const cardsAt = new Map(t.decided.map((d) => [d.at, d.proposals]));
  const pushCards = (proposals: Proposal[]) => items.push({ kind: "proposals", proposals });
  t.messages.forEach((m, idx) => {
    const blocks = typeof m.content === "string" ? [{ type: "text", text: m.content }] : m.content;
    const texts = blocks
      .filter((b): b is { type: "text"; text: string } => b.type === "text" && "text" in b)
      .map((b) => b.text);
    // Las líneas que nombran un archivo (092) se dibujan como el archivo,
    // no como texto.
    const files: AttachedFile[] = [];
    const prose: string[] = [];
    for (const tx of texts) {
      const f = m.role === "user" ? parseFileNote(tx) : null;
      if (f) files.push(f);
      else prose.push(tx);
    }
    const text = prose.join("\n\n").trim();
    if (m.role === "user" && (text || files.length > 0)) {
      items.push({ kind: "user", text, ...(files.length > 0 ? { files } : {}) });
    } else if (m.role === "assistant" && text) {
      const prev = items[items.length - 1];
      if (prev?.kind === "assistant") prev.text += `\n\n${text}`;
      else items.push({ kind: "assistant", text });
    }
    const cards = cardsAt.get(idx);
    if (cards) pushCards(cards);
  });
  if (t.pending) pushCards(t.pending.proposals);
  return items;
}

async function saveThread(supabase: SupabaseClient, t: Thread): Promise<void> {
  const { error } = await supabase
    .from("treasury_assistant_threads")
    .update({
      messages: t.messages,
      pending: t.pending,
      decided: t.decided,
      input_tokens: t.input_tokens,
      output_tokens: t.output_tokens,
      updated_at: new Date().toISOString(),
    })
    .eq("id", t.id);
  if (error) console.error("[treasury-assistant] saveThread", error);
}

/** Cuántas preguntas hizo la persona en las últimas 24 horas. */
export async function turnsToday(supabase: SupabaseClient, userId: string): Promise<number> {
  const since = new Date(Date.now() - 24 * 3600 * 1000).toISOString();
  const { count } = await supabase
    .from("treasury_assistant_turns")
    .select("id", { count: "exact", head: true })
    .eq("profile_id", userId)
    .gte("created_at", since);
  return count ?? 0;
}

// ─── El bucle ──────────────────────────────────────────────────────────

function resultsFor(pending: Pending): ToolResult[] {
  return pending.toolUseIds.map((id) => {
    const done = pending.results[id];
    if (done) return done;
    const p = pending.proposals.find((x) => x.toolUseId === id);
    const content =
      p?.status === "hecho"
        ? `El tesorero confirmó. ${p.outcome ?? ""}${p.entryId ? ` Id del movimiento: ${p.entryId}.` : ""}`
        : p?.status === "fallo"
          ? `El tesorero confirmó, pero el Libro lo rechazó: ${p.outcome ?? ""}`
          : (p?.outcome ?? "El tesorero descartó la propuesta.");
    return { type: "tool_result", tool_use_id: id, content, is_error: p?.status === "fallo" };
  });
}

async function runLoop(ctx: AgentContext, t: Thread, userContent: Msg["content"]): Promise<void> {
  const { emit } = ctx;
  t.messages.push({ role: "user", content: userContent });
  let turnIn = 0;
  let turnOut = 0;

  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      // `fallbacks: "default"`: si el modelo declina por sus salvaguardas,
      // la API reintenta en el modelo que corresponda dentro del mismo
      // pedido. El SDK instalado todavía no tipa el campo.
      const params = {
        model: MODEL,
        max_tokens: 16000,
        betas: ["server-side-fallback-2026-07-01", FILES_BETA],
        fallbacks: "default",
        output_config: { effort: "medium" },
        system: [
          { type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
          {
            type: "text",
            text: contextBlock({
              today: ctx.today,
              localityName: ctx.localityName,
              localityKind: ctx.localityKind,
              userName: ctx.userName,
              bahaiYear: ctx.bahaiYear,
            }),
          },
        ],
        tools: TOOLS,
        messages: t.messages,
        // La caché automática pone el último corte en el historial: la
        // pregunta siguiente relee la conversación a una décima del precio.
        cache_control: { type: "ephemeral" },
      } as unknown as Anthropic.Beta.Messages.MessageCreateParamsStreaming;

      const stream = anthropic().beta.messages.stream(params);
      stream.on("text", (delta) => emit({ type: "text", delta }));
      const msg = await stream.finalMessage();

      turnIn +=
        (msg.usage.input_tokens ?? 0) +
        (msg.usage.cache_read_input_tokens ?? 0) +
        (msg.usage.cache_creation_input_tokens ?? 0);
      turnOut += msg.usage.output_tokens ?? 0;
      t.messages.push({ role: "assistant", content: msg.content as Msg["content"] });

      if (msg.stop_reason === "refusal") {
        emit({ type: "text", delta: "\n\nNo puedo ayudar con eso." });
        break;
      }
      if (msg.stop_reason === "pause_turn") continue;

      const uses = msg.content.filter(
        (b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use"
      );
      if (uses.length === 0) break;
      if (msg.stop_reason === "max_tokens") {
        throw new Error("La respuesta se cortó por largo. Probá con una pregunta más acotada.");
      }

      const pending: Pending = { toolUseIds: uses.map((u) => u.id), results: {}, proposals: [] };
      const outcomes = await Promise.all(
        uses.map(async (u) => {
          emit({ type: "tool", label: TOOL_LABELS[u.name] ?? u.name });
          return { u, out: await runTool(ctx, u.name, (u.input ?? {}) as Record<string, unknown>, u.id) };
        })
      );
      for (const { u, out } of outcomes) {
        if (out.type === "proposal") pending.proposals.push(out.proposal);
        else
          pending.results[u.id] = {
            type: "tool_result",
            tool_use_id: u.id,
            content: out.content,
            ...(out.isError ? { is_error: true } : {}),
          };
      }

      if (pending.proposals.length > 0) {
        t.pending = pending;
        emit({ type: "proposals", proposals: pending.proposals });
        break;
      }
      t.messages.push({ role: "user", content: resultsFor(pending) });
    }
  } finally {
    t.input_tokens += turnIn;
    t.output_tokens += turnOut;
    await saveThread(ctx.supabase, t);
    if (turnIn || turnOut) {
      await ctx.supabase.from("treasury_assistant_turns").insert({
        thread_id: t.id,
        profile_id: ctx.userId,
        locality_id: ctx.localityId,
        input_tokens: turnIn,
        output_tokens: turnOut,
      });
    }
  }
}

/**
 * Una pregunta nueva, con los archivos adjuntos ya convertidos en bloques
 * (`attachFiles`). Si quedaban propuestas sin decidir, cuentan como
 * descartadas.
 */
export async function ask(
  ctx: AgentContext,
  t: Thread,
  text: string,
  fileBlocks: Anthropic.Beta.BetaContentBlockParam[] = []
): Promise<void> {
  let content: Msg["content"] = [...fileBlocks, { type: "text", text }];
  if (t.pending) {
    for (const p of t.pending.proposals) {
      if (p.status === "pendiente") {
        p.status = "descartado";
        p.outcome = "El tesorero no la confirmó y escribió otro mensaje.";
      }
    }
    content = [...resultsFor(t.pending), ...fileBlocks, { type: "text", text }];
    settle(t);
  }
  await runLoop(ctx, t, content);
}

/** Las tarjetas resueltas pasan a la historia, al lado del mensaje que las pidió. */
function settle(t: Thread): void {
  if (!t.pending) return;
  t.decided.push({ at: t.messages.length - 1, proposals: t.pending.proposals });
  t.pending = null;
}

/**
 * El tesorero confirma o descarta UNA propuesta, y se ejecuta en el
 * momento. Corre ANTES de abrir el stream de la respuesta: los actions del
 * Libro leen la sesión de las cookies y revalidan rutas, y eso tiene que
 * pasar dentro del pedido, no mientras ya se está mandando la respuesta.
 */
export async function applyDecision(
  supabase: SupabaseClient,
  t: Thread,
  toolUseId: string,
  confirm: boolean
): Promise<Proposal | null> {
  const p = t.pending?.proposals.find((x) => x.toolUseId === toolUseId);
  if (!t.pending || !p) return null;
  if (p.status === "pendiente") {
    if (confirm) {
      const r = await executeProposal(supabase, p);
      p.status = r.ok ? "hecho" : "fallo";
      p.outcome = r.message;
      p.entryId = r.entryId ?? null;
    } else {
      p.status = "descartado";
      p.outcome = "El tesorero descartó la propuesta.";
    }
    await saveThread(supabase, t);
  }
  return p;
}

/** Cuando ya no queda ninguna propuesta por decidir, el asistente sigue con los resultados. */
export async function resumeIfDecided(ctx: AgentContext, t: Thread): Promise<void> {
  if (!t.pending || t.pending.proposals.some((x) => x.status === "pendiente")) return;
  const results = resultsFor(t.pending);
  settle(t);
  await runLoop(ctx, t, results);
}
