import { ArrowRight, Check } from "lucide-react";
import { SectionHeading } from "./sectionHeading";
import type { LandingCopy } from "@/lib/landing/fr";

interface MetricsSectionProps { copy: LandingCopy }

export function MetricsSection({ copy }: MetricsSectionProps) {
  return (
    <section id="metrics" className="section section-tinted" data-testid="metrics">
      <div className="container">
        <div className="metrics-heading"><SectionHeading {...copy.metrics} /><p>{copy.metrics.note}</p></div>
        <div className="metric-grid">{copy.metrics.items.map(([title, label, description], index) => <article key={title}><span className="metric-index">0{index + 1}<ArrowRight size={17} /></span><h3>{title}</h3><strong>{label}</strong><p>{description}</p></article>)}</div>
        <div className="reading-feed"><span>{copy.metrics.activity}</span>{copy.metrics.feed.map((line) => <span key={line}><Check size={14} />{line}</span>)}</div>
      </div>
    </section>
  );
}
