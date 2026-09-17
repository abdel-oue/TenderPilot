import { BookOpen, ShieldCheck, ListChecks, ScanText, CircleHelp, UserRoundCheck, ArrowUpRight } from "lucide-react";
import { SectionHeading } from "./sectionHeading";
import type { LandingCopy } from "@/lib/landing/fr";

const TRUST_ICONS = [BookOpen, ShieldCheck, ListChecks, ScanText, CircleHelp, UserRoundCheck];
interface SecuritySectionProps { copy: LandingCopy }

export function SecuritySection({ copy }: SecuritySectionProps) {
  return (
    <section id="approach" className="section section-tinted" data-testid="approach">
      <div className="container">
        <SectionHeading {...copy.security} centered />
        <div className="trust-grid">{copy.security.items.map(([title, description], index) => { const Icon = TRUST_ICONS[index]; return <article className="card" key={title}><Icon size={23} strokeWidth={1.4} /><h3>{title}</h3><p>{description}</p></article>; })}</div>
        <div className="trust-banner"><ShieldCheck size={30} strokeWidth={1.3} /><div><h3>{copy.security.banner}</h3><p>{copy.security.bannerNote}</p></div><a className="icon-button" href="#demo" aria-label={copy.demo}><ArrowUpRight size={23} /></a></div>
      </div>
    </section>
  );
}
