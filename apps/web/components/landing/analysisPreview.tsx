"use client";

import { useRef, useState } from "react";
import { ArrowUpRight, FileText, CircleAlert, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/classNameUtils";
import { CARD, NOTE, PREVIEW_FOOTER, TEXT_LINK } from "@/lib/utils/landingStyleUtils";
import type { LandingCopy } from "@/lib/landing/fr";

interface AnalysisPreviewProps { copy: LandingCopy }

const SUBTITLE = "mt-6 mb-2 text-xs font-semibold";

export function AnalysisPreview({ copy }: AnalysisPreviewProps) {
  const [tab, setTab] = useState(0);
  const [sourceOpen, setSourceOpen] = useState(false);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const demo = copy.demoSection;

  function selectTab(index: number) { setTab(index); tabRefs.current[index]?.focus(); }

  return (
    <div className={cn(CARD, "overflow-hidden shadow-card md:mt-5")} data-testid="analysis-preview">
      <div className="flex gap-1.5 border-b border-border bg-soft p-2.5" role="tablist" aria-label={demo.eyebrow}>
        {demo.tabs.map((label, index) => (
          <button
            ref={(node) => { tabRefs.current[index] = node; }}
            key={label}
            role="tab"
            id={`analysis-tab-${index}`}
            aria-selected={tab === index}
            aria-controls={`analysis-panel-${index}`}
            tabIndex={tab === index ? 0 : -1}
            className={cn(
              "cursor-pointer rounded-sm px-3.5 py-2.5 text-xs text-muted sm:px-4.5",
              tab === index && "bg-surface text-foreground shadow-sm",
            )}
            onClick={() => setTab(index)}
            onKeyDown={(event) => { if (["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) { event.preventDefault(); selectTab(event.key === "Home" ? 0 : event.key === "End" ? 2 : (tab + (event.key === "ArrowRight" ? 1 : 2)) % 3); } }}
            data-testid={`analysis-tab-${index}`}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="p-5.5 sm:p-7.5 md:min-h-91" role="tabpanel" id={`analysis-panel-${tab}`} aria-labelledby={`analysis-tab-${tab}`} tabIndex={0} data-testid="analysis-panel">
        <p className="mb-3.5 flex justify-between text-mini tracking-widest text-muted">{demo.reference}<FileText size={15} /></p>
        <h3 className="mb-6 text-lg font-semibold tracking-tight">{demo.tender}</h3>
        {tab === 0 && (
          <>
            <div className="flex gap-3 rounded-md bg-warning-soft p-4.5 text-warning">
              <CircleAlert size={19} className="shrink-0" />
              <div>
                <strong className="block text-sm font-semibold">{demo.verdict}</strong>
                <p className="mt-2 text-xs leading-relaxed">{demo.verdictText}</p>
              </div>
            </div>
            <p className={SUBTITLE}>{demo.next}</p>
            <p className="text-xs leading-relaxed text-muted">{demo.nextText}</p>
            <button className={TEXT_LINK} onClick={() => { selectTab(2); setSourceOpen(true); }} data-testid="view-source">
              {demo.openSource}
              <ArrowUpRight size={16} />
            </button>
          </>
        )}
        {tab === 1 && (
          <div>
            {demo.rows.map(([label, status], index) => (
              <div key={label} className="flex items-center justify-between gap-4.5 border-b border-border py-4.5 text-sm">
                <span>{label}</span>
                <span className={cn("rounded-sm bg-warning-soft px-2 py-1 text-mini whitespace-nowrap text-warning", index === 1 && "bg-accent-soft text-positive")}>{status}</span>
              </div>
            ))}
          </div>
        )}
        {tab === 2 && (
          <div>
            <p className={SUBTITLE}>{demo.sourceTitle}</p>
            <span className="text-tiny text-muted">{demo.sourceRef}</span>
            <button
              className="mt-5 flex w-full cursor-pointer items-center justify-between gap-2.5 rounded-md border border-border bg-soft p-3.5 text-left text-xs"
              aria-expanded={sourceOpen}
              aria-controls="source-excerpt"
              onClick={() => setSourceOpen(!sourceOpen)}
              data-testid="source-toggle"
            >
              {sourceOpen ? demo.closeSource : demo.openSource}
              <ChevronDown size={16} />
            </button>
            <div id="source-excerpt" hidden={!sourceOpen} data-testid="source-excerpt">
              <blockquote className="mt-5.5 border-l-2 border-accent pl-4 font-heading text-base leading-relaxed italic">« {demo.quote} »</blockquote>
              <p className={NOTE}>{demo.sourceNote}</p>
            </div>
          </div>
        )}
      </div>
      <div className={PREVIEW_FOOTER}>{demo.sample}</div>
    </div>
  );
}
