import { ArrowRight, ArrowUpRight } from "lucide-react";
import { BrandLogo } from "./brandLogo";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { cn } from "@/lib/utils/classNameUtils";
import { LEAD } from "@/lib/utils/landingStyleUtils";
import type { LandingCopy } from "@/lib/landing/fr";

interface CtaSectionProps { copy: LandingCopy }

export function CtaSection({ copy }: CtaSectionProps) {
  return (
    <Container as="section" className="pt-2.5 pb-16 md:pb-25" data-testid="cta">
      <div className="relative grid grid-cols-1 gap-7 overflow-hidden rounded-xl bg-inverse-surface px-7 py-9 text-inverse md:grid-cols-4 md:p-16">
        <div className="relative z-1 md:col-span-3">
          <Eyebrow className="text-micro text-inverse-muted sm:text-micro">{copy.cta.eyebrow}</Eyebrow>
          <h2 className="font-heading text-panel font-normal tracking-display text-balance whitespace-pre-line">{copy.cta.title}</h2>
          <p className={cn(LEAD, "text-inverse-muted md:text-base")}>{copy.cta.description}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Button variant="primary" href="/signup" data-testid="cta-start" className="border-inverse bg-inverse text-inverse-surface hover:bg-inverse">
              {copy.discover}
              <ArrowUpRight size={17} />
            </Button>
            <Button href="#how-it-works" className="border-inverse-border text-inverse hover:bg-inverse-border">
              {copy.cta.secondary}
              <ArrowRight size={17} />
            </Button>
          </div>
          <p className="mt-4.5 text-xs text-inverse-muted">{copy.cta.note}</p>
        </div>
        <div className="relative hidden place-items-center md:grid" aria-hidden="true">
          <span className="absolute size-77.5 rounded-full border border-inverse-border" />
          <span className="absolute size-102.5 rounded-full border border-inverse-border" />
          <BrandLogo mark />
        </div>
      </div>
    </Container>
  );
}
