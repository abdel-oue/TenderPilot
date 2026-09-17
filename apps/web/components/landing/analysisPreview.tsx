"use client";

import { useRef, useState } from "react";
import { ArrowUpRight, FileText, CircleAlert, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils/classNameUtils";
import type { LandingCopy } from "@/lib/landing/fr";

interface AnalysisPreviewProps { copy: LandingCopy }

export function AnalysisPreview({ copy }: AnalysisPreviewProps) {
  const [tab, setTab] = useState(0);
  const [sourceOpen, setSourceOpen] = useState(false);
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const demo = copy.demoSection;

  function selectTab(index: number) { setTab(index); tabRefs.current[index]?.focus(); }

  return (
    <div className="card analysis-preview" data-testid="analysis-preview">
      <div className="analysis-tabs" role="tablist" aria-label={demo.eyebrow}>
        {demo.tabs.map((label, index) => <button ref={(node) => { tabRefs.current[index] = node; }} key={label} role="tab" id={`analysis-tab-${index}`} aria-selected={tab === index} aria-controls={`analysis-panel-${index}`} tabIndex={tab === index ? 0 : -1} className={cn("analysis-tab", tab === index && "is-active")} onClick={() => setTab(index)} onKeyDown={(event) => { if (["ArrowRight", "ArrowLeft", "Home", "End"].includes(event.key)) { event.preventDefault(); selectTab(event.key === "Home" ? 0 : event.key === "End" ? 2 : (tab + (event.key === "ArrowRight" ? 1 : 2)) % 3); } }} data-testid={`analysis-tab-${index}`}>{label}</button>)}
      </div>
      <div className="analysis-content" role="tabpanel" id={`analysis-panel-${tab}`} aria-labelledby={`analysis-tab-${tab}`} tabIndex={0} data-testid="analysis-panel">
        <p className="analysis-reference">{demo.reference}<FileText size={15} /></p><h3 className="analysis-title">{demo.tender}</h3>
        {tab === 0 && <><div className="verdict-note"><CircleAlert size={19} /><div><strong>{demo.verdict}</strong><p>{demo.verdictText}</p></div></div><p className="analysis-subtitle">{demo.next}</p><p className="analysis-next">{demo.nextText}</p><button className="text-link" onClick={() => { selectTab(2); setSourceOpen(true); }} data-testid="view-source">{demo.openSource}<ArrowUpRight size={16} /></button></>}
        {tab === 1 && <div className="requirement-list">{demo.rows.map(([label, status], index) => <div key={label}><span>{label}</span><span className={cn("status-label", index === 1 && "status-positive")}>{status}</span></div>)}</div>}
        {tab === 2 && <div className="source-card"><p className="analysis-subtitle">{demo.sourceTitle}</p><span className="source-reference">{demo.sourceRef}</span><button className="source-toggle" aria-expanded={sourceOpen} aria-controls="source-excerpt" onClick={() => setSourceOpen(!sourceOpen)} data-testid="source-toggle">{sourceOpen ? demo.closeSource : demo.openSource}<ChevronDown size={16} /></button><div id="source-excerpt" hidden={!sourceOpen} data-testid="source-excerpt"><blockquote>« {demo.quote} »</blockquote><p className="small-note">{demo.sourceNote}</p></div></div>}
      </div>
      <div className="preview-footer">{demo.sample}</div>
    </div>
  );
}
