type BahaiStarProps = {
  size?: number;
  color?: string;
  opacity?: number;
  className?: string;
};

/**
 * 9-pointed Bahá'í star — used as a watermark in gold headers and the
 * featured message card.
 *
 * Math: 9 outer points at radius 44 (of a 100×100 viewBox), 9 inner points
 * at radius 22, alternating at 20° offset / 40° spacing, rotated so the
 * first point sits at the top.
 */
export function BahaiStar({
  size = 24,
  color = "currentColor",
  opacity = 1,
  className,
}: BahaiStarProps) {
  const pts: string[] = [];
  for (let i = 0; i < 9; i++) {
    const outerAngle = ((i * 40 - 90) * Math.PI) / 180;
    const innerAngle = ((i * 40 + 20 - 90) * Math.PI) / 180;
    pts.push(
      `${50 + 44 * Math.cos(outerAngle)},${50 + 44 * Math.sin(outerAngle)}`
    );
    pts.push(
      `${50 + 22 * Math.cos(innerAngle)},${50 + 22 * Math.sin(innerAngle)}`
    );
  }
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={{ opacity }}
      className={className}
      aria-hidden="true"
    >
      <polygon points={pts.join(" ")} fill={color} />
    </svg>
  );
}
