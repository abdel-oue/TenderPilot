import { ArrowUpRight, Check } from "lucide-react";
import { SectionHeading } from "./sectionHeading";
import type { LandingCopy } from "@/lib/landing/fr";

interface InfrastructureSectionProps { copy: LandingCopy }

export function InfrastructureSection({ copy }: InfrastructureSectionProps) {
  return (
    <section className="section" id="dossier" data-testid="dossier">
      <div className="container split">
        <div><SectionHeading {...copy.infrastructure} /><div className="detail-list">{copy.infrastructure.items.map(([title, description]) => <div key={title}><Check size={18} /><div><h3>{title}</h3><p>{description}</p></div></div>)}</div></div>
        <div className="dossier-stack">{copy.infrastructure.rows.map(([title, description, tag]) => <div className="card dossier-row" key={tag}><span className="document-tag">{tag}</span><div><h3>{title}</h3><p>{description}</p></div><ArrowUpRight size={17} /></div>)}<p className="dossier-note">{copy.infrastructure.footer}</p></div>
      </div>
    </section>
  );
}
