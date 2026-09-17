import { FileSearch, ShieldCheck, Link2, Building2, ListChecks, Compass, Check, FileText } from "lucide-react";
import { SectionHeading } from "./sectionHeading";
import type { LandingCopy } from "@/lib/landing/fr";

const FEATURE_ICONS = [FileSearch, ShieldCheck, Link2, Building2, ListChecks, Compass];
interface FeaturesSectionProps { copy: LandingCopy }

export function FeaturesSection({ copy }: FeaturesSectionProps) {
  return (
    <section id="features" className="section" data-testid="features">
      <div className="container">
        <div className="split feature-intro">
          <SectionHeading {...copy.features} />
          <div className="document-scene" aria-hidden="true">
            <div className="document-shadow" />
            <div className="document-sheet"><div className="document-top"><FileText size={22} /><span>TenderPilot</span></div><div className="document-rule long" /><div className="document-rule" /><div className="document-divider" />{copy.features.items.slice(0, 3).map(([title], index) => <div className="document-check" key={title}><span>0{index + 1}</span><div><strong>{title}</strong><div className="document-rule" /></div><Check size={15} /></div>)}<div className="document-seal"><Compass size={26} /></div></div>
            <div className="document-caption"><span className="status-dot" />{copy.hero.note}</div>
          </div>
        </div>
        <div className="feature-grid">{copy.features.items.map(([title, description], index) => { const Icon = FEATURE_ICONS[index]; return <article className="feature-card" key={title}><div className="feature-icon"><Icon size={23} strokeWidth={1.4} /></div><h3>{title}</h3><p>{description}</p></article>; })}</div>
      </div>
    </section>
  );
}
