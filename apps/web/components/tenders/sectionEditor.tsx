"use client";
// EX-06: review and correct one section, and keep the correction.
//
// The textarea is a controlled component with a save button. No <form onSubmit>.
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useSaveSection } from "@/hooks/useAnalysis";
import type { AnalysisSection } from "@/lib/types";

interface SectionEditorProps {
  tenderId: string;
  runId: string;
  section: AnalysisSection;
}

export default function SectionEditor({ tenderId, runId, section }: SectionEditorProps) {
  const [content, setContent] = useState(section.content);
  const [open, setOpen] = useState(false);
  const save = useSaveSection(tenderId, runId);

  const dirty = content !== section.content;

  return (
    <article data-testid="section" data-section-key={section.sectionKey} className="rounded-md border border-border bg-surface p-4">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="font-heading text-lg">{section.title}</h3>
        {section.editedByHuman ? (
          <span data-testid="section-edited" className="text-mini uppercase text-accent">
            corrigée
          </span>
        ) : null}
      </div>

      {section.validatedByHuman ? <p data-testid="section-validated" className="mt-2 text-xs text-accent">Validée par un humain</p> : null}
      {section.needsHuman ? (
        <div data-testid="section-warnings" role="status" className="mt-3 rounded border border-border bg-warning-soft p-3 text-sm">
          <p>À compléter ou à valider par un humain.</p>
          {(section.complianceWarnings ?? []).map((warning, index) => <p key={index}>{warning}</p>)}
        </div>
      ) : null}

      {open ? (
        <textarea
          data-testid="section-textarea"
          className="mt-3 min-h-64 w-full rounded-md border border-border bg-background p-3 text-sm"
          value={content}
          onChange={(event) => setContent(event.target.value)}
        />
      ) : (
        <p className="mt-3 whitespace-pre-wrap text-sm text-muted">{section.content}</p>
      )}

      <div className="mt-3 flex items-center gap-3">
        <Button data-testid="section-toggle" onClick={() => setOpen(!open)}>
          {open ? "Fermer" : "Corriger"}
        </Button>
        <Button data-testid="section-validate" disabled={save.isPending || dirty || section.validatedByHuman}
          onClick={() => save.mutate({ sectionKey: section.sectionKey, title: section.title, content, validatedByHuman: true })}>
          Valider cette section
        </Button>
        {open ? (
          <Button
            data-testid="section-save"
            variant="primary"
            disabled={save.isPending}
            onClick={() =>
              save.mutate({ sectionKey: section.sectionKey, title: section.title, content })
            }
          >
            {save.isPending ? "Enregistrement…" : "Enregistrer"}
          </Button>
        ) : null}
        {dirty && !save.isPending ? (
          <span className="text-mini text-muted">modifications non enregistrées</span>
        ) : null}
      </div>

      {/* Three states, always: the error from the mutation is shown, not swallowed. */}
      {save.isError ? (
        <p data-testid="section-error" className="mt-2 text-sm text-no-go">
          {(save.error as Error).message}
        </p>
      ) : null}
    </article>
  );
}
