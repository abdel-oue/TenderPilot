import Image from "next/image";
import { cn } from "@/lib/utils/classNameUtils";

interface BrandLogoProps { mark?: boolean; className?: string }

export function BrandLogo({ mark = false, className }: BrandLogoProps) {
  return (
    <span className={cn("brand-logo", mark && "brand-mark", className)}>
      <Image src={mark ? "/brand/tenderpilot-mark.png" : "/brand/tenderpilot-logo.png"} alt={mark ? "" : "TenderPilot"} width={mark ? 1280 : 2172} height={mark ? 1280 : 724} sizes={mark ? "300px" : "200px"} loading={mark ? "lazy" : "eager"} />
    </span>
  );
}
