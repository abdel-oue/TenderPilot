"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { TENDER_DOCUMENT_KINDS } from "@tenderpilot/shared";
import UploadPanel from "./uploadPanel";
import { useCreateDossier } from "@/hooks/useTenders";
import { INPUT } from "@/lib/utils/workspaceStyleUtils";
export default function NewDossierPanel() {
  const [reference, setReference] = useState("");
  const [title, setTitle] = useState("");
  const [validation, setValidation] = useState<string | null>(null);
  const create = useCreateDossier();
  const router = useRouter();
  return <UploadPanel kinds={TENDER_DOCUMENT_KINDS} multiple busy={create.isPending}
    error={validation ?? (create.isError ? create.error.message : null)} submitLabel="Créer le dossier"
    onSubmit={(files, kind) => {
      if (!reference.trim()) { setValidation("Indiquez une référence pour ce dossier."); return; }
      setValidation(null);
      create.mutate({ reference: reference.trim(), title: title.trim() || undefined, files, kind }, { onSuccess: (tender) => router.push(`/tenders/${tender.id}`) });
    }}>
    <div className="grid gap-5 md:grid-cols-2">
      <label className="space-y-2 text-sm font-medium">Référence du dossier <span className="text-accent">*</span><input data-testid="dossier-reference" className={INPUT} placeholder="Ex. AO-2026-004" value={reference} disabled={create.isPending} onChange={(event) => setReference(event.target.value)} /></label>
      <label className="space-y-2 text-sm font-medium">Intitulé <span className="font-normal text-muted">(facultatif)</span><input data-testid="dossier-title" className={INPUT} placeholder="Ex. Assistance technique et conseil" value={title} disabled={create.isPending} onChange={(event) => setTitle(event.target.value)} /></label>
    </div>
  </UploadPanel>;
}
