import Image from "next/image";
import { cn } from "@/lib/utils/classNameUtils";

interface BrandLogoProps { mark?: boolean; className?: string }

// The source artwork has baked-in padding, so the frame clips an oversized,
// absolutely positioned image rather than scaling it.
export function BrandLogo({ mark = false, className }: BrandLogoProps) {
  return (
    <span
      className={cn(
        "relative block overflow-hidden",
        mark ? "h-52 w-42" : "h-10 w-34 sm:w-36 md:w-42",
        className,
      )}
    >
      <Image
        src={mark ? "/brand/tenderpilot-mark.png" : "/brand/tenderpilot-logo.png"}
        alt={mark ? "" : "TenderPilot"}
        width={mark ? 1280 : 2172}
        height={mark ? 1280 : 724}
        sizes={mark ? "300px" : "200px"}
        loading={mark ? "lazy" : "eager"}
        className={cn(
          "absolute h-auto max-w-none",
          mark
            ? "-top-12 -left-15 w-75 opacity-80"
            : "-top-1 -left-2.5 w-38 invert hue-rotate-180 sm:-top-2 sm:-left-3 sm:w-44 md:-top-3 md:-left-4 md:w-49 dark:invert-0 dark:hue-rotate-0",
        )}
      />
    </span>
  );
}
