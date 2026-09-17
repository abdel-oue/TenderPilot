import { Files, ClipboardList, BriefcaseBusiness, FileCheck2, ArrowRight } from "lucide-react";
import { SectionHeading } from "./sectionHeading";
import { Container } from "@/components/ui/container";
import { cn } from "@/lib/utils/classNameUtils";
import { CARD, HEADING_3, SECTION, SPLIT, TEXT_LINK } from "@/lib/utils/landingStyleUtils";
import type { LandingCopy } from "@/lib/landing/fr";

const DOCUMENT_ICONS = [Files, ClipboardList, BriefcaseBusiness, FileCheck2];
interface IntegrationsSectionProps { copy: LandingCopy }

export function IntegrationsSection({ copy }: IntegrationsSectionProps) {
  return (
    <section id="documents" className={SECTION} data-testid="documents">
      <Container>
        <SectionHeading {...copy.integrations} centered />
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
          {copy.integrations.items.map(([title, description], index) => {
            const Icon = DOCUMENT_ICONS[index];
            return (
              <article className={cn(CARD, "px-4.5 py-9 text-center")} key={title}>
                <Icon size={30} strokeWidth={1.3} className="mx-auto mb-6 text-accent" />
                <h3 className={HEADING_3}>{title}</h3>
                <p className="mt-2.5 text-xs leading-relaxed text-muted">{description}</p>
              </article>
            );
          })}
        </div>
        <div className={cn(CARD, SPLIT, "mt-9 gap-7 bg-soft p-6 md:gap-16 md:p-10")}>
          <div>
            <h3 className="font-heading text-figure font-normal">{copy.integrations.callout}</h3>
            <p className="mt-4 text-sm leading-relaxed text-muted">{copy.integrations.detail}</p>
            <a className={TEXT_LINK} href="#demo">
              {copy.demo}
              <ArrowRight size={16} />
            </a>
          </div>
          <div className="rounded-md border border-border bg-surface p-6.5">
            <span className="mb-2 block text-mini text-muted">{copy.integrations.example[0]}</span>
            <strong className="block text-sm font-medium">{copy.integrations.example[1]}</strong>
            <div className="my-3 h-6 border-l border-dashed border-border" />
            <span className="mb-2 block text-mini text-muted">{copy.integrations.example[2]}</span>
            <strong className="block text-sm font-medium">{copy.integrations.example[3]}</strong>
          </div>
        </div>
      </Container>
    </section>
  );
}
