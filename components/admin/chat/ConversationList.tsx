import Link from "next/link";
import { Card } from "@/components/admin/ui";

export type ConversationSummary = {
  member_id: string;
  member_name: string;
  member_email: string;
  last_text: string;
  last_at: string;
  unread: number;
};

/**
 * Bandeja de conversaciones de un canal del chat. La usan las dos
 * pantallas (Secretaría y Tesorería); lo único que cambia es `basePath`,
 * porque cada canal tiene su propia ruta y su propio tag.
 */
export function ConversationList({
  conversations,
  basePath,
  emptyText,
}: {
  conversations: ConversationSummary[];
  basePath: string;
  emptyText: string;
}) {
  if (conversations.length === 0) {
    return (
      <Card className="text-center text-[13px] text-muted">{emptyText}</Card>
    );
  }

  return (
    <Card className="overflow-hidden p-0">
      <ul className="divide-y divide-black/[0.05]">
        {conversations.map((c) => (
          <li key={c.member_id}>
            <Link
              href={`${basePath}/${c.member_id}`}
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
  );
}

function formatRelative(iso: string): string {
  const diffMin = (Date.now() - new Date(iso).getTime()) / 60000;
  if (diffMin < 1) return "ahora";
  if (diffMin < 60) return `${Math.round(diffMin)} min`;
  if (diffMin < 60 * 24) return `${Math.round(diffMin / 60)} h`;
  return `${Math.round(diffMin / 60 / 24)} d`;
}
