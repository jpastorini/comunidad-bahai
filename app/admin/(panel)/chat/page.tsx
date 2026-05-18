import Link from "next/link";
import { Card, PageHeader } from "@/components/admin/ui";
import { ensureChatTag, requireAdmin } from "@/lib/auth";
import { createSupabaseServer } from "@/lib/supabase/server";
import { RealtimeRefresher } from "./realtime-refresher";

type ConversationSummary = {
  member_id: string;
  member_name: string;
  member_email: string;
  last_text: string;
  last_at: string;
  unread: number;
};

export default async function AdminChatListPage() {
  const session = await requireAdmin();
  ensureChatTag(session.profile);
  const supabase = createSupabaseServer();

  const { data: messages } = await supabase
    .from("chat_messages")
    .select("member_id, from_user_id, text, created_at, read, is_admin_reply")
    .order("created_at", { ascending: false });

  // Group by member_id
  const map = new Map<string, ConversationSummary>();
  for (const m of messages ?? []) {
    let conv = map.get(m.member_id);
    if (!conv) {
      conv = {
        member_id: m.member_id,
        member_name: "Cargando...",
        member_email: "",
        last_text: m.text,
        last_at: m.created_at,
        unread: 0,
      };
      map.set(m.member_id, conv);
    }
    // Unread = mensaje entrante (no respuesta de admin) sin leer.
    if (!m.is_admin_reply && !m.read) conv.unread += 1;
  }

  // Resolve member names
  const ids = Array.from(map.keys());
  if (ids.length > 0) {
    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, full_name, email")
      .in("id", ids);
    for (const p of profiles ?? []) {
      const conv = map.get(p.id);
      if (conv) {
        conv.member_name = p.full_name || "Sin nombre";
        conv.member_email = p.email ?? "";
      }
    }
  }

  const conversations = Array.from(map.values()).sort(
    (a, b) => new Date(b.last_at).getTime() - new Date(a.last_at).getTime()
  );

  return (
    <>
      <RealtimeRefresher />
      <PageHeader
        eyebrow="Secretaría"
        title="Conversaciones"
        description="Responde a los miembros que han escrito a la Secretaría."
      />

      {conversations.length === 0 ? (
        <Card className="text-center text-[13px] text-muted">
          No hay conversaciones todavía.
        </Card>
      ) : (
        <Card className="overflow-hidden p-0">
          <ul className="divide-y divide-black/[0.05]">
            {conversations.map((c) => (
              <li key={c.member_id}>
                <Link
                  href={`/admin/chat/${c.member_id}`}
                  className="flex items-center gap-4 px-5 py-4 transition hover:bg-bg"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-terra/10 text-terra">
                    <span className="font-display text-base font-bold">
                      {(c.member_name?.[0] ?? "?").toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[14px] font-semibold text-dark">
                        {c.member_name}
                      </span>
                      <span className="text-[11px] text-muted">
                        {formatRelative(c.last_at)}
                      </span>
                    </div>
                    <div className="line-clamp-1 text-[12px] text-muted">
                      {c.last_text}
                    </div>
                  </div>
                  {c.unread > 0 && (
                    <span className="ml-2 flex h-6 min-w-[24px] items-center justify-center rounded-full bg-terra px-1.5 text-[11px] font-bold text-white">
                      {c.unread}
                    </span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </>
  );
}

function formatRelative(iso: string): string {
  const diffMin = (Date.now() - new Date(iso).getTime()) / 60000;
  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `${Math.round(diffMin)} min`;
  if (diffMin < 60 * 24) return `${Math.round(diffMin / 60)} h`;
  return `${Math.round(diffMin / 60 / 24)} d`;
}
