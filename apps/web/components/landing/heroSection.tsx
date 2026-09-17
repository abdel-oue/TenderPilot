import { ArrowRight, ArrowUpRight } from "lucide-react";
import type { LandingCopy } from "@/lib/landing/fr";

interface HeroSectionProps { copy: LandingCopy }

export function HeroSection({ copy }: HeroSectionProps) {
  return (
    <section className="hero" aria-labelledby="hero-title" data-testid="hero">
      <div className="hero-lines" aria-hidden="true"><i /><i /><i /><i /><i /></div>
      <div className="container hero-content">
        <p className="eyebrow">{copy.hero.eyebrow}</p>
        <h1 id="hero-title" data-testid="hero-title">{copy.hero.title}<br /><em>{copy.hero.emphasis}</em></h1>
        <p className="lead">{copy.hero.description}</p>
        <div className="actions"><a className="button button-primary" href="#demo" data-testid="hero-demo">{copy.demo}<ArrowUpRight size={17} /></a><a className="button" href="#features">{copy.explore}<ArrowRight size={17} /></a></div>
        <p className="small-note">{copy.hero.note}</p>
        <div className="hero-stats">{copy.hero.stats.map(([number, label, description]) => <div key={number}><span className="stat-number">{number}</span><h3>{label}</h3><p>{description}</p></div>)}</div>
      </div>
    </section>
  );
}
