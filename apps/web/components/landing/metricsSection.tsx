import { ArrowRight, Check } from "lucide-react";
import { SectionHeading } from "./sectionHeading";
import { Container } from "@/components/ui/container";
import { cn } from "@/lib/utils/classNameUtils";
import { SECTION, SECTION_TINTED } from "@/lib/utils/landingStyleUtils";
import type { LandingCopy } from "@/lib/landing/fr";

interface MetricsSectionProps { copy: LandingCopy }

export function MetricsSection({ copy }: MetricsSectionProps) {
  return (
    <section id="metrics" className={cn(SECTION, SECTION_TINTED)} data-testid="metrics">
      <Container>
        <div className="mb-12 md:flex md:items-end md:justify-between md:gap-8">
          <SectionHeading {...copy.metrics} className="mb-0" />
          <p className="mt-5 text-xs text-muted md:mt-0">{copy.metrics.note}</p>
        </div>
        <div className="grid grid-cols-2 overflow-hidden rounded-card border border-border bg-surface md:grid-cols-4">
          {copy.metrics.items.map(([title, label, description], index) => (
            <article
              key={title}
              className={cn(
                "border-border p-5.5 md:border-r md:last:border-r-0 lg:p-7",
                index % 2 === 0 && "border-r",
                index < 2 && "border-b md:border-b-0",
              )}
            >
              <span className="mb-7.5 flex items-center justify-between text-mini text-muted">
                0{index + 1}
                <ArrowRight size={17} />
              </span>
              <h3 className="mb-6 font-heading text-figure font-normal">{title}</h3>
              <strong className="text-xs font-medium">{label}</strong>
              <p className="mt-2 text-xs leading-relaxed text-muted">{description}</p>
            </article>
          ))}
        </div>
        <div className="mt-6 flex flex-col flex-wrap items-start gap-4 py-5 text-mini text-muted md:flex-row md:items-center md:gap-6.5">
          <span className="font-semibold text-foreground">{copy.metrics.activity}</span>
          {copy.metrics.feed.map((line) => (
            <span key={line} className="flex items-center gap-2">
              <Check size={14} />
              {line}
            </span>
          ))}
        </div>
      </Container>
    </section>
  );
}
