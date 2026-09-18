"use client";
// EX-01: register a dossier and upload its PDFs in one go.
import { useState } from "react";
import { TENDER_DOCUMENT_KINDS } from "@tenderpilot/shared";
import UploadPanel from "./uploadPanel";
import { useCreateDossier } from "@/hooks/useTenders";

export default function NewDossierPanel() {
  const [reference, setReference] = useState("");
  const create = useCreateDossier();

  return (
    <UploadPanel
      kinds={TENDER_DOCUMENT_KINDS}
      multiple
      busy={create.isPending}
      error={create.isError ? (create.error as Error).message : null}
      submitLabel="Déposer le dossier"
      onSubmit={(files, kind) => {
        if (!reference.trim()) return;
        create.mutate({ reference: reference.trim(), files, kind });
      }}
    >
      <input
        data-testid="dossier-reference"
        className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        placeholder="Référence du dossier, ex. AO-2026-004"
        value={reference}
        onChange={(event) => setReference(event.target.value)}
      />
    </UploadPanel>
  );
}
