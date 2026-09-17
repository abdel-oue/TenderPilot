import { SectionHeading } from "./sectionHeading";
import { AnalysisPreview } from "./analysisPreview";
import type { LandingCopy } from "@/lib/landing/fr";

interface DevelopersSectionProps { copy: LandingCopy }

// Keeps the template's split demo section, adapted to the tender review workflow.
export function DevelopersSection({ copy }: DevelopersSectionProps) {
  return (
    <section id="demo" className="section" data-testid="demo">
      <div className="container split demo-split">
        <div><SectionHeading {...copy.demoSection} /><div className="demo-points">{copy.demoSection.points.map(([title, description]) => <div key={title}><h3>{title}</h3><p>{description}</p></div>)}</div></div>
        <AnalysisPreview copy={copy} />
      </div>
    </section>
  );
}
