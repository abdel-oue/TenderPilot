"use client";

import { useState } from "react";
import { ArrowUpRight, FileText, Check } from "lucide-react";
import { SectionHeading } from "./sectionHeading";
import { Container } from "@/components/ui/container";
import { Eyebrow } from "@/components/ui/eyebrow";
import { cn } from "@/lib/utils/classNameUtils";
import { CARD, PREVIEW_FOOTER, SECTION, SECTION_TINTED, SPLIT, STATUS_DOT } from "@/lib/utils/landingStyleUtils";
import type { LandingCopy } from "@/lib/landing/fr";

interface HowItWorksSectionProps { copy: LandingCopy }

export function HowItWorksSection({ copy }: HowItWorksSectionProps) {
  const [step, setStep] = useState(0);
  const active = copy.workflow.steps[step];
  return (
    <section id="how-it-works" className={cn(SECTION, SECTION_TINTED)} data-testid="workflow">
      <Container>
        <SectionHeading {...copy.workflow} />
        <div className={cn(SPLIT, "items-stretch md:gap-16")}>
          <div className="flex flex-col justify-center gap-2.5">
            {copy.workflow.steps.map(([title, description], index) => (
              <button
                className={cn(
                  "flex cursor-pointer items-start gap-4.5 rounded-lg border border-transparent bg-transparent px-4 py-5 text-left transition duration-200 hover:bg-background md:p-6",
                  step === index && "border-border bg-surface shadow-card",
                )}
                key={title}
                onClick={() => setStep(index)}
                aria-pressed={step === index}
                aria-controls="workflow-preview"
                data-testid={`workflow-step-${index}`}
              >
                <span className="mt-1 text-xs text-muted">0{index + 1}</span>
                <span>
                  <strong className="text-base font-semibold">{title}</strong>
                  <span className="mt-2.5 block text-sm leading-relaxed text-muted">{description}</span>
                </span>
                <ArrowUpRight size={18} className="ml-auto text-muted" />
              </button>
            ))}
          </div>
          <div
            id="workflow-preview"
            className={cn(CARD, "self-center overflow-hidden shadow-card max-md:w-full")}
            aria-live="polite"
            data-testid="workflow-preview"
          >
            <div className="flex items-center gap-3 border-b border-border px-5 py-4 text-tiny text-muted">
              <div className="flex gap-1">
                <i className="size-1.5 rounded-full border border-border" />
                <i className="size-1.5 rounded-full border border-border" />
                <i className="size-1.5 rounded-full border border-border" />
              </div>
              <span>{copy.workflow.preview}</span>
              <span className="ml-auto">0{step + 1} / 03</span>
            </div>
            <div className="p-7.5 md:min-h-80">
              <span className="mb-6 inline-flex rounded-lg border border-border p-3 text-accent">
                <FileText size={25} strokeWidth={1.4} />
              </span>
              <Eyebrow className="mb-3 text-mini sm:text-mini">{active[2]}</Eyebrow>
              <h3 className="text-lg font-semibold tracking-tight">{active[3]}</h3>
              <div className="mt-5">
                {active.slice(4).map((line) => (
                  <div key={line} className="flex items-center gap-2.5 py-2 text-xs text-muted">
                    <Check size={16} className="text-positive" />
                    <span>{line}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className={PREVIEW_FOOTER}>
              <span className={STATUS_DOT} />
              {copy.workflow.illustration}
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
