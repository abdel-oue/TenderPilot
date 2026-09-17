import { cn } from "@/lib/utils/classNameUtils";
import { Eyebrow } from "@/components/ui/eyebrow";
import { HEADING_2, LEAD } from "@/lib/utils/landingStyleUtils";

interface SectionHeadingProps { eyebrow: string; title: string; description?: string; centered?: boolean; className?: string }

export function SectionHeading({ eyebrow, title, description, centered, className }: SectionHeadingProps) {
  return (
    <div className={cn("mb-9 md:mb-14", centered && "mx-auto max-w-170 text-center", className)}>
      <Eyebrow className={cn(centered && "justify-center")}>{eyebrow}</Eyebrow>
      <h2 className={HEADING_2}>{title}</h2>
      {description && <p className={cn(LEAD, centered && "mx-auto")}>{description}</p>}
    </div>
  );
}
