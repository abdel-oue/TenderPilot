import { Files, ClipboardList, BriefcaseBusiness, FileCheck2, ArrowRight } from "lucide-react";
import { SectionHeading } from "./sectionHeading";
import type { LandingCopy } from "@/lib/landing/fr";

const DOCUMENT_ICONS = [Files, ClipboardList, BriefcaseBusiness, FileCheck2];
interface IntegrationsSectionProps { copy: LandingCopy }

export function IntegrationsSection({ copy }: IntegrationsSectionProps) {
  return (
    <section id="documents" className="section" data-testid="documents">
      <div className="container">
        <SectionHeading {...copy.integrations} centered />
        <div className="document-grid">{copy.integrations.items.map(([title, description], index) => { const Icon = DOCUMENT_ICONS[index]; return <article className="card" key={title}><Icon size={30} strokeWidth={1.3} /><h3>{title}</h3><p>{description}</p></article>; })}</div>
        <div className="context-callout card split"><div><h3>{copy.integrations.callout}</h3><p>{copy.integrations.detail}</p><a className="text-link" href="#demo">{copy.demo}<ArrowRight size={16} /></a></div><div className="context-example"><span>{copy.integrations.example[0]}</span><strong>{copy.integrations.example[1]}</strong><div className="context-connector" /><span>{copy.integrations.example[2]}</span><strong>{copy.integrations.example[3]}</strong></div></div>
      </div>
    </section>
  );
}
