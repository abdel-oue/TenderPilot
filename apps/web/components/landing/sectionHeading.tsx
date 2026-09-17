import { cn } from "@/lib/utils/classNameUtils";

interface SectionHeadingProps { eyebrow: string; title: string; description?: string; centered?: boolean }

export function SectionHeading({ eyebrow, title, description, centered }: SectionHeadingProps) {
  return (
    <div className={cn("section-heading", centered && "centered")}>
      <p className="eyebrow">{eyebrow}</p>
      <h2>{title}</h2>
      {description && <p className="lead">{description}</p>}
    </div>
  );
}
