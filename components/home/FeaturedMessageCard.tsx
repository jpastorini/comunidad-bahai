import Link from "next/link";
import { BahaiStar } from "../BahaiStar";
import { IconArrowRight } from "../Icons";

type Props = {
  eyebrow?: string;
  title: string;
  excerpt: string;
  ctaLabel?: string;
  href: string;
};

export function FeaturedMessageCard({
  eyebrow = "✦ Comunicado reciente",
  title,
  excerpt,
  ctaLabel = "Leer comunicado",
  href,
}: Props) {
  return (
    <Link
      href={href}
      className="tap relative mb-3 block overflow-hidden rounded-[18px] bg-terra-grad px-[18px] py-[15px]"
    >
      <div className="pointer-events-none absolute -bottom-3 -right-2 opacity-[0.06]">
        <BahaiStar size={80} color="#fff" />
      </div>
      <div className="mb-[7px] text-[9px] font-semibold uppercase tracking-[1.5px] text-white/55">
        {eyebrow}
      </div>
      <h2 className="mb-1 font-display text-[18px] font-semibold leading-[1.25] text-white">
        {title}
      </h2>
      <p className="mb-2.5 font-body text-[11.5px] leading-[1.5] text-white/70 line-clamp-2">
        {excerpt}
      </p>
      <div className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-white">
        {ctaLabel}
        <IconArrowRight size={12} />
      </div>
    </Link>
  );
}
