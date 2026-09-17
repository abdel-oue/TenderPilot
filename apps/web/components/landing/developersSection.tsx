import { SectionHeading } from "./sectionHeading";
import { AnalysisPreview } from "./analysisPreview";
import { Container } from "@/components/ui/container";
import { cn } from "@/lib/utils/classNameUtils";
import { SECTION, SPLIT } from "@/lib/utils/landingStyleUtils";
import type { LandingCopy } from "@/lib/landing/fr";

interface DevelopersSectionProps { copy: LandingCopy }

// Keeps the template's split demo section, adapted to the tender review workflow.
export function DevelopersSection({ copy }: DevelopersSectionProps) {
  return (
    <section id="demo" className={SECTION} data-testid="demo">
      <Container className={cn(SPLIT, "items-start")}>
        <div>
          <SectionHeading {...copy.demoSection} />
          <div className="grid gap-6">
            {copy.demoSection.points.map(([title, description]) => (
              <div key={title} className="border-l-2 border-border pl-4.5">
                <h3 className="text-sm font-semibold tracking-tight">{title}</h3>
                <p className="mt-2 text-xs leading-relaxed text-muted">{description}</p>
              </div>
            ))}
          </div>
        </div>
        <AnalysisPreview copy={copy} />
      </Container>
    </section>
  );
}
