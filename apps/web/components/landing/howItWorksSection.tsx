"use client";

import { useState } from "react";
import { ArrowUpRight, FileText, Check } from "lucide-react";
import { SectionHeading } from "./sectionHeading";
import { cn } from "@/lib/utils/classNameUtils";
import type { LandingCopy } from "@/lib/landing/fr";

interface HowItWorksSectionProps { copy: LandingCopy }

export function HowItWorksSection({ copy }: HowItWorksSectionProps) {
  const [step, setStep] = useState(0);
  const active = copy.workflow.steps[step];
  return (
    <section id="how-it-works" className="section section-tinted" data-testid="workflow">
      <div className="container">
        <SectionHeading {...copy.workflow} />
        <div className="split workflow-grid">
          <div className="workflow-steps">{copy.workflow.steps.map(([title, description], index) => <button className={cn("workflow-step", step === index && "is-active")} key={title} onClick={() => setStep(index)} aria-pressed={step === index} aria-controls="workflow-preview" data-testid={`workflow-step-${index}`}><span className="step-number">0{index + 1}</span><span><strong>{title}</strong><span className="step-description">{description}</span></span><ArrowUpRight size={18} /></button>)}</div>
          <div id="workflow-preview" className="card workflow-preview" aria-live="polite" data-testid="workflow-preview">
            <div className="window-bar"><div className="window-dots"><i /><i /><i /></div><span>{copy.workflow.preview}</span><span>0{step + 1} / 03</span></div>
            <div className="workflow-preview-body"><span className="preview-icon"><FileText size={25} strokeWidth={1.4} /></span><p className="eyebrow">{active[2]}</p><h3>{active[3]}</h3><div className="preview-list">{active.slice(4).map((line) => <div key={line}><Check size={16} /><span>{line}</span></div>)}</div></div>
            <div className="preview-footer"><span className="status-dot" />{copy.workflow.illustration}</div>
          </div>
        </div>
      </div>
    </section>
  );
}
