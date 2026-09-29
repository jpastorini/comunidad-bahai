import { NextResponse } from "next/server";
import { createSupabaseServer } from "@/lib/supabase/server";

/**
 * El service worker recibió un aviso de chat: el mensaje llegó al
 * teléfono, o sea "recibido" (doble check, migración 071).
 * Body: { topic, memberId } — la conversación de la que habla el aviso.
 *
 * La RPC decide qué puede marcar quien llama (su propia conversación como
 * creyente, o las de los canales que atiende); acá solo se valida la forma.
 */
export async function POST(request: Request) {
  let body: { topic?: string; memberId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "bad-json" }, { status: 400 });
  }
  const topic =
    body.topic === "secretaria" || body.topic === "tesoreria" ? body.topic : null;
  const memberId =
    typeof body.memberId === "string" && /^[0-9a-f-]{36}$/i.test(body.memberId)
      ? body.memberId
      : null;
  if (!topic || !memberId) {
    return NextResponse.json({ error: "missing-fields" }, { status: 400 });
  }

  const supabase = createSupabaseServer();
  const { error } = await supabase.rpc("mark_chat_delivered", {
    p_topic: topic,
    p_member_id: memberId,
  });
  if (error) {
    console.error("[chat] delivered:", error.message);
    return NextResponse.json({ error: "rpc" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
