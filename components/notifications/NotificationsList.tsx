"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { REACTION_EMOJIS } from "@/lib/reaction-emojis";
import type {
  ReactionEmoji,
  SocialNotification,
  SocialNotificationType,
} from "@/lib/types";

type Props = {
  notifications: SocialNotification[];
  thumbnails: Record<string, string>;
};

type FilterKey = "all" | SocialNotificationType;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "Todas" },
  { key: "reaction", label: "Reacciones" },
  { key: "comment", label: "Comentarios" },
];

const EMOJI_CHAR: Record<ReactionEmoji, string> = Object.fromEntries(
  REACTION_EMOJIS.map((r) => [r.key, r.char])
) as Record<ReactionEmoji, string>;

export function NotificationsList({ notifications, thumbnails }: Props) {
  const [filter, setFilter] = useState<FilterKey>("all");

  const filtered = useMemo(
    () =>
      filter === "all"
        ? notifications
        : notifications.filter((n) => n.type === filter),
    [notifications, filter]
  );

  return (
    <>
      <div className="flex gap-2 overflow-x-auto px-4 py-3">
        {FILTERS.map((f) => {
          const active = filter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={
                "shrink-0 rounded-full px-3.5 py-1.5 text-[11.5px] font-semibold transition-colors " +
                (active
                  ? "bg-terra text-white"
                  : "bg-muted/15 text-muted hover:bg-muted/25")
              }
            >
              {f.label}
            </button>
          );
        })}
      </div>

      {filtered.length === 0 ? (
        <div className="px-6 py-12 text-center">
          <p className="text-[13px] text-muted">
            {filter === "all"
              ? "Aún no tenés notificaciones. Cuando alguien reaccione o comente tus fotos, vas a verlas acá."
              : "No hay notificaciones en este filtro."}
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-black/[0.05]">
          {filtered.map((n) => (
            <NotificationItem
              key={n.id}
              notification={n}
              thumbnail={n.photo_id ? thumbnails[n.photo_id] ?? null : null}
            />
          ))}
        </ul>
      )}
    </>
  );
}

function NotificationItem({
  notification: n,
  thumbnail,
}: {
  notification: SocialNotification;
  thumbnail: string | null;
}) {
  const isUnread = n.read_at === null;
  const href =
    n.event_type && n.event_id
      ? n.event_type === "calendar"
        ? `/calendario/${n.event_id}/galeria`
        : `/fiestas/${n.event_id}/galeria`
      : "#";

  let body: React.ReactNode;
  if (n.type === "reaction") {
    const emoji = (n.emoji && EMOJI_CHAR[n.emoji]) ?? "❤";
    body = (
      <>
        <strong className="font-semibold">{n.actor_name}</strong> reaccionó{" "}
        {emoji} a tu foto
      </>
    );
  } else {
    body = (
      <>
        <strong className="font-semibold">{n.actor_name}</strong> comentó tu
        foto
        {n.preview && (
          <span className="block italic text-muted">“{n.preview}”</span>
        )}
      </>
    );
  }

  return (
    <li>
      <Link
        href={href}
        className={
          "tap flex items-start gap-3 px-4 py-3.5 " +
          (isUnread ? "bg-terra/[0.04]" : "")
        }
      >
        <div className="relative shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-terra/15 text-[12px] font-semibold uppercase text-terra">
            {initials(n.actor_name)}
          </div>
          {isUnread && (
            <span
              aria-hidden="true"
              className="absolute -left-0.5 top-0 h-2 w-2 rounded-full bg-terra ring-2 ring-bg"
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[12.5px] leading-snug text-dark">{body}</div>
          <div className="mt-0.5 text-[10.5px] text-muted">
            {formatRelative(n.created_at)}
          </div>
        </div>
        {thumbnail && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={thumbnail}
            alt=""
            className="h-10 w-10 shrink-0 rounded-md object-cover"
          />
        )}
      </Link>
    </li>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).slice(0, 2);
  return parts.map((p) => p[0]?.toUpperCase() ?? "").join("");
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - then);
  const m = Math.floor(diff / 60_000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `hace ${d} d`;
  return new Date(iso).toLocaleDateString("es-MX", {
    day: "numeric",
    month: "short",
  });
}
