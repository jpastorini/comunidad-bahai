/**
 * Fase B del tablero de tareas: extracción de tareas desde el acta de una
 * reunión de la Asamblea. El acta se sube como .docx, se extrae el texto
 * con `mammoth` (en memoria, NO se guarda el binario) y se le pide a Claude
 * que devuelva la lista de tareas/acciones acordadas en formato estructurado.
 *
 * Solo se usa desde server actions (necesita el ANTHROPIC_API_KEY del entorno).
 */

import Anthropic from "@anthropic-ai/sdk";
import mammoth from "mammoth";
import type { TaskPriority } from "@/lib/tasks";

/** Una tarea tal como la propone Claude antes de que el secretario la edite. */
export type ExtractedTask = {
  description: string;
  assignee: string | null;
  priority: TaskPriority;
  due_date: string | null;
};

export type ExtractResult =
  | { ok: true; tasks: ExtractedTask[] }
  | { ok: false; error: string };

/** Extrae el texto plano de un .docx subido (en memoria, sin persistir). */
export async function extractDocxText(buffer: Buffer): Promise<string> {
  const { value } = await mammoth.extractRawText({ buffer });
  return value.trim();
}

const TASK_TOOL: Anthropic.Tool = {
  name: "registrar_tareas",
  description:
    "Registra la lista de tareas y acciones acordadas que surgen del acta de la reunión de la Asamblea.",
  input_schema: {
    type: "object",
    properties: {
      tasks: {
        type: "array",
        description:
          "Lista de tareas concretas que la Asamblea acordó realizar. Vacía si el acta no contiene acciones.",
        items: {
          type: "object",
          properties: {
            description: {
              type: "string",
              description:
                "Qué hay que hacer, redactado como acción concreta. Ej: 'Enviar carta de bienvenida a la familia nueva'.",
            },
            assignee: {
              type: "string",
              description:
                "Nombre del miembro o comité responsable. Dejar vacío ('') si el acta no lo indica.",
            },
            priority: {
              type: "string",
              enum: ["alta", "media", "baja"],
              description:
                "Prioridad inferida. Usar 'media' si no hay indicios claros.",
            },
            due_date: {
              type: "string",
              description:
                "Fecha límite en formato YYYY-MM-DD si el acta la menciona. Dejar vacío ('') si no hay fecha.",
            },
          },
          required: ["description", "assignee", "priority", "due_date"],
        },
      },
    },
    required: ["tasks"],
  },
};

const SYSTEM_PROMPT = `Sos un asistente que ayuda a la secretaría de una Asamblea Espiritual Local bahá'í.
Recibís el texto de un acta de reunión y tu tarea es identificar las tareas y acciones concretas que la Asamblea acordó llevar a cabo.

Pautas:
- Extraé SOLO acciones concretas (algo que alguien tiene que hacer). Ignorá deliberaciones, informes, lecturas de oraciones y temas que no derivan en una acción.
- Redactá cada tarea como una acción clara y breve, empezando con un verbo.
- Si el acta nombra un responsable (persona o comité), incluilo; si no, dejá el campo vacío.
- Si menciona una fecha límite, normalizala a YYYY-MM-DD; si no, dejá la fecha vacía.
- Inferí la prioridad solo si hay señales claras (urgente, importante); en la duda usá 'media'.
- Si el acta no contiene ninguna acción, devolvé una lista vacía.
Devolvé el resultado llamando a la herramienta registrar_tareas.`;

function normalizePriority(value: unknown): TaskPriority {
  return value === "alta" || value === "baja" ? value : "media";
}

function normalizeDate(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  // Solo aceptamos un YYYY-MM-DD bien formado; cualquier otra cosa => null.
  return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
}

function normalizeAssignee(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/**
 * Le pide a Claude que extraiga las tareas del texto del acta.
 * Devuelve un resultado tipado: nunca lanza por errores esperables de la API.
 */
export async function extractTasksFromText(text: string): Promise<ExtractResult> {
  if (!text || text.length < 20) {
    return {
      ok: false,
      error:
        "El acta parece vacía o demasiado corta. Revisá que el archivo tenga texto.",
    };
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return {
      ok: false,
      error:
        "Falta configurar ANTHROPIC_API_KEY en el servidor. Avisá al equipo técnico.",
    };
  }

  const client = new Anthropic();

  try {
    const message = await client.messages.create({
      model: "claude-opus-4-7",
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      tools: [TASK_TOOL],
      tool_choice: { type: "tool", name: "registrar_tareas" },
      messages: [{ role: "user", content: text }],
    });

    const toolUse = message.content.find(
      (block): block is Anthropic.ToolUseBlock =>
        block.type === "tool_use" && block.name === "registrar_tareas"
    );

    if (!toolUse) {
      return {
        ok: false,
        error: "Claude no devolvió tareas. Probá de nuevo o cargalas a mano.",
      };
    }

    const input = toolUse.input as { tasks?: unknown };
    const rawTasks = Array.isArray(input.tasks) ? input.tasks : [];

    const tasks: ExtractedTask[] = rawTasks
      .map((t): ExtractedTask | null => {
        if (typeof t !== "object" || t === null) return null;
        const obj = t as Record<string, unknown>;
        const description =
          typeof obj.description === "string" ? obj.description.trim() : "";
        if (!description) return null;
        return {
          description,
          assignee: normalizeAssignee(obj.assignee),
          priority: normalizePriority(obj.priority),
          due_date: normalizeDate(obj.due_date),
        };
      })
      .filter((t): t is ExtractedTask => t !== null);

    return { ok: true, tasks };
  } catch (err) {
    if (err instanceof Anthropic.AuthenticationError) {
      return {
        ok: false,
        error:
          "La clave de la API de Claude es inválida o expiró. Avisá al equipo técnico.",
      };
    }
    if (err instanceof Anthropic.RateLimitError) {
      return {
        ok: false,
        error: "La API está saturada en este momento. Esperá unos segundos y reintentá.",
      };
    }
    const detail = err instanceof Error ? err.message : "Error desconocido";
    return { ok: false, error: `No se pudo procesar el acta: ${detail}` };
  }
}
