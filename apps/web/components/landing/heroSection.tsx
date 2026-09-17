import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { cn } from "@/lib/utils/classNameUtils";
import { LEAD, NOTE } from "@/lib/utils/landingStyleUtils";
import type { LandingCopy } from "@/lib/landing/fr";

interface HeroSectionProps { copy: LandingCopy }

// Concentric decorative ellipses behind the hero, widest last.
const RINGS = [
  "w-400 h-200 -top-33 -ml-200",
  "w-430 h-233 -top-49 -ml-215",
  "w-465 h-267 -top-66 -ml-233",
  "w-500 h-303 -top-84 -ml-250",
  "w-535 h-338 -top-101 -ml-268",
];

export function HeroSection({ copy }: HeroSectionProps) {
  return (
    <section className="relative pt-31 pb-14 text-center sm:pt-35 md:pt-42 md:pb-18" aria-labelledby="hero-title" data-testid="hero">
      <div className="pointer-events-none absolute inset-0 overflow-hidden opacity-75" aria-hidden="true">
        {RINGS.map((ring) => (
          <i key={ring} className={cn("absolute left-1/2 -rotate-15 rounded-full border border-line", ring)} />
        ))}
      </div>
      <Container className="relative z-1">
        <Eyebrow className="justify-center">{copy.hero.eyebrow}</Eyebrow>
        <h1
          id="hero-title"
          data-testid="hero-title"
          className="font-heading text-hero-sm font-normal tracking-display text-balance whitespace-pre-line md:text-hero"
        >
          {copy.hero.title}
          <br />
          <em className="font-normal text-accent">{copy.hero.emphasis}</em>
        </h1>
        <p className={cn(LEAD, "mx-auto max-w-148")}>{copy.hero.description}</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Button variant="primary" href="#demo" data-testid="hero-demo">
            {copy.demo}
            <ArrowUpRight size={17} />
          </Button>
          <Button href="#features">
            {copy.explore}
            <ArrowRight size={17} />
          </Button>
        </div>
        <p className={NOTE}>{copy.hero.note}</p>
        <div className="mt-11 grid grid-cols-2 rounded-lg border border-border bg-surface text-left shadow-card md:mt-18 md:grid-cols-4">
          {copy.hero.stats.map(([number, label, description], index) => (
            <div
              key={number}
              className={cn(
                "border-border p-5 md:border-r md:p-6.5 md:last:border-r-0",
                index % 2 === 0 && "border-r",
                index < 2 && "border-b md:border-b-0",
              )}
            >
              <span className="mb-4.5 block text-mini text-muted">{number}</span>
              <h3 className="text-base font-semibold tracking-tight">{label}</h3>
              <p className="mt-1.5 text-tiny leading-relaxed text-muted md:text-xs">{description}</p>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
