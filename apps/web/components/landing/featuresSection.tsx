import { FileSearch, ShieldCheck, Link2, Building2, ListChecks, Compass, Check, FileText } from "lucide-react";
import { SectionHeading } from "./sectionHeading";
import { Container } from "@/components/ui/container";
import { cn } from "@/lib/utils/classNameUtils";
import { CARD, HEADING_3, SECTION, SPLIT, STATUS_DOT } from "@/lib/utils/landingStyleUtils";
import type { LandingCopy } from "@/lib/landing/fr";

const FEATURE_ICONS = [FileSearch, ShieldCheck, Link2, Building2, ListChecks, Compass];
const RULE = "mt-2.5 h-1 rounded-sm bg-border";
interface FeaturesSectionProps { copy: LandingCopy }

export function FeaturesSection({ copy }: FeaturesSectionProps) {
  return (
    <section id="features" className={SECTION} data-testid="features">
      <Container>
        <div className={cn(SPLIT, "mb-15")}>
          <SectionHeading {...copy.features} className="mb-0" />
          <div className="relative flex h-89 scale-90 items-center justify-center sm:scale-100" aria-hidden="true">
            <div className="absolute h-67.5 w-77.5 translate-x-3.5 -translate-y-3 rotate-6 rounded-md border border-border bg-soft" />
            <div className="relative w-77.5 -rotate-5 rounded-md border border-border bg-surface p-6 shadow-card">
              <div className="mb-5.5 flex items-center gap-2.5 text-sm font-semibold">
                <FileText size={22} />
                <span>TenderPilot</span>
              </div>
              <div className={cn(RULE, "w-11/12")} />
              <div className={cn(RULE, "w-3/5")} />
              <div className="my-5.5 h-px bg-border" />
              {copy.features.items.slice(0, 3).map(([title], index) => (
                <div className="my-4 flex items-center gap-2.5 text-micro" key={title}>
                  <span className="text-muted">0{index + 1}</span>
                  <div className="flex-1">
                    <strong className="font-medium">{title}</strong>
                    <div className={cn(RULE, "w-3/5")} />
                  </div>
                  <Check size={15} className="text-positive" />
                </div>
              ))}
              <div className="absolute -right-5 -bottom-4.5 grid size-15 place-items-center rounded-full border border-border bg-accent-soft text-accent">
                <Compass size={26} />
              </div>
            </div>
            <div className={cn(CARD, "absolute -bottom-2 left-0 flex items-center gap-2 rounded-sm px-4 py-2.5 text-micro shadow-card sm:left-10 sm:text-tiny")}>
              <span className={STATUS_DOT} />
              {copy.hero.note}
            </div>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-x-6 sm:grid-cols-2 md:grid-cols-3 md:gap-x-9">
          {copy.features.items.map(([title, description], index) => {
            const Icon = FEATURE_ICONS[index];
            return (
              <article className="border-t border-border py-7.5" key={title}>
                <div className="mb-5.5 text-accent">
                  <Icon size={23} strokeWidth={1.4} />
                </div>
                <h3 className={HEADING_3}>{title}</h3>
                <p className="mt-3 text-xs leading-relaxed text-muted sm:text-sm">{description}</p>
              </article>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
