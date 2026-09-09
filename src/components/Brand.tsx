import Image from "next/image";
import { clsx } from "@/lib/clsx";

const LOGO_W = 900;
const LOGO_H = 716;

/**
 * The full Dus2 PORI artwork. The store name is part of the logo, so this is
 * used on its own rather than paired with typed-out text.
 */
export function BrandLogo({
  width = 200,
  className,
  priority,
}: {
  width?: number;
  className?: string;
  priority?: boolean;
}) {
  return (
    <Image
      src="/logo.png"
      alt="Dus2 PORI"
      width={width}
      height={Math.round((width * LOGO_H) / LOGO_W)}
      className={clsx("h-auto", className)}
      style={{ width }}
      priority={priority}
      sizes={`${width}px`}
    />
  );
}

/** Square crowned-fairy mark, for tight spots like the app icon slot. */
export function BrandMark({
  size = 40,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <span
      className={clsx(
        "grid shrink-0 place-items-center overflow-hidden rounded-2xl bg-gradient-to-br from-plum-800 to-plum-950 ring-1 ring-white/10",
        className,
      )}
      style={{ width: size, height: size }}
    >
      <Image
        src="/mark.png"
        alt=""
        width={size}
        height={size}
        className="h-[76%] w-[76%] object-contain"
      />
    </span>
  );
}
