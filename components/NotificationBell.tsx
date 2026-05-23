import Link from "next/link";
import { IconBell } from "./Icons";

type Props = {
  unreadCount: number;
  /** Color del ícono. Default white para usar dentro del header dorado. */
  color?: string;
};

export function NotificationBell({ unreadCount, color = "#fff" }: Props) {
  const hasUnread = unreadCount > 0;
  return (
    <Link
      href="/notificaciones"
      aria-label={
        hasUnread
          ? `Notificaciones (${unreadCount} sin leer)`
          : "Notificaciones"
      }
      className="tap relative inline-flex h-10 w-10 items-center justify-center"
      style={{ color }}
    >
      <IconBell size={22} />
      {hasUnread && (
        <span
          aria-hidden="true"
          className="absolute right-1 top-1 flex h-[16px] min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-bold leading-none text-white shadow ring-2 ring-[#C4A235]"
        >
          {unreadCount > 9 ? "9+" : unreadCount}
        </span>
      )}
    </Link>
  );
}
