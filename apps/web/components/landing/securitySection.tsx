import { BookOpen, ShieldCheck, ListChecks, ScanText, CircleHelp, UserRoundCheck, ArrowUpRight } from "lucide-react";
import { SectionHeading } from "./sectionHeading";
import { Container } from "@/components/ui/container";
import { cn } from "@/lib/utils/classNameUtils";
import { CARD, HEADING_3, ICON_BUTTON, SECTION, SECTION_TINTED } from "@/lib/utils/landingStyleUtils";
import type { LandingCopy } from "@/lib/landing/fr";

const TRUST_ICONS = [BookOpen, ShieldCheck, ListChecks, ScanText, CircleHelp, UserRoundCheck];
interface SecuritySectionProps { copy: LandingCopy }

export function SecuritySection({ copy }: SecuritySectionProps) {
  return (
    <section id="approach" className={cn(SECTION, SECTION_TINTED)} data-testid="approach">
      <Container>
        <SectionHeading {...copy.security} centered />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 md:gap-4.5">
          {copy.security.items.map(([title, description], index) => {
            const Icon = TRUST_ICONS[index];
            return (
              <article className={cn(CARD, "p-6 md:p-7.5")} key={title}>
                <Icon size={23} strokeWidth={1.4} className="mb-5.5 text-accent" />
                <h3 className={HEADING_3}>{title}</h3>
                <p className="mt-3 text-sm leading-relaxed text-muted">{description}</p>
              </article>
            );
          })}
        </div>
        <div className="mt-10 flex items-start gap-3 border-t border-border pt-8 md:items-center md:gap-5">
          <ShieldCheck size={30} strokeWidth={1.3} className="shrink-0 text-accent" />
          <div>
            <h3 className="text-sm font-semibold tracking-tight md:text-base">{copy.security.banner}</h3>
            <p className="mt-1.5 text-xs leading-relaxed text-muted">{copy.security.bannerNote}</p>
          </div>
          <a className={cn(ICON_BUTTON, "ml-auto shrink-0")} href="#demo" aria-label={copy.demo}>
            <ArrowUpRight size={23} />
          </a>
        </div>
      </Container>
    </section>
  );
}
