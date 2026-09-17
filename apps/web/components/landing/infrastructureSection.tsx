import { ArrowUpRight, Check } from "lucide-react";
import { SectionHeading } from "./sectionHeading";
import { Container } from "@/components/ui/container";
import { cn } from "@/lib/utils/classNameUtils";
import { CARD, SECTION, SPLIT } from "@/lib/utils/landingStyleUtils";
import type { LandingCopy } from "@/lib/landing/fr";

interface InfrastructureSectionProps { copy: LandingCopy }

export function InfrastructureSection({ copy }: InfrastructureSectionProps) {
  return (
    <section className={SECTION} id="dossier" data-testid="dossier">
      <Container className={SPLIT}>
        <div>
          <SectionHeading {...copy.infrastructure} />
          <div className="grid gap-6">
            {copy.infrastructure.items.map(([title, description]) => (
              <div key={title} className="flex gap-4">
                <Check size={18} className="mt-1 shrink-0 text-accent" />
                <div>
                  <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="grid gap-3">
          {copy.infrastructure.rows.map(([title, description, tag]) => (
            <div className={cn(CARD, "flex items-center gap-3 px-3.5 py-5 sm:gap-4.5 sm:px-5 sm:py-6")} key={tag}>
              <span className="grid h-13.5 w-12 shrink-0 place-items-center rounded-sm border border-border bg-soft text-micro text-muted">
                {tag}
              </span>
              <div>
                <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">{description}</p>
              </div>
              <ArrowUpRight size={17} className="ml-auto shrink-0 text-muted" />
            </div>
          ))}
          <p className="pt-3.5 text-center text-xs text-muted">{copy.infrastructure.footer}</p>
        </div>
      </Container>
    </section>
  );
}
