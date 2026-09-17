import { ArrowRight, ArrowUpRight } from "lucide-react";
import { BrandLogo } from "./brandLogo";
import type { LandingCopy } from "@/lib/landing/fr";

interface CtaSectionProps { copy: LandingCopy }

export function CtaSection({ copy }: CtaSectionProps) {
  return (
    <section className="cta-section container" data-testid="cta">
      <div className="cta-panel"><div><p className="eyebrow">{copy.cta.eyebrow}</p><h2>{copy.cta.title}</h2><p className="lead">{copy.cta.description}</p><div className="actions"><a className="button button-primary" href="#demo">{copy.demo}<ArrowUpRight size={17} /></a><a className="button" href="#how-it-works">{copy.cta.secondary}<ArrowRight size={17} /></a></div><p className="small-note">{copy.cta.note}</p></div><div className="cta-art" aria-hidden="true"><span /><span /><BrandLogo mark /></div></div>
    </section>
  );
}
