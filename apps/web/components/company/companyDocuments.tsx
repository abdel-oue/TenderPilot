"use client";
import { useState } from "react";
import { FileText, ArrowUpRight } from "lucide-react";
import { COMPANY_DOCUMENT_KINDS } from "@tenderpilot/shared";
import { useCompanyDocuments, useUploadCompanyDocument } from "@/hooks/useCompany";
import { sourcePageUrl } from "@/lib/api/documents";
import UploadPanel from "@/components/tenders/uploadPanel";
export function CompanyDocuments() {
  const documents = useCompanyDocuments();
  const upload = useUploadCompanyDocument();
  const [uploadKey, setUploadKey] = useState(0);
  return <section className="space-y-4"><div><h2 className="font-heading text-2xl">Vos documents de référence</h2><p className="mt-2 text-sm leading-6 text-muted">Attestations et mémoires déjà rendus : des preuves concrètes pour appuyer vos réponses.</p></div>
    {documents.isPending ? <div className="h-20 animate-pulse rounded-xl bg-soft" /> : documents.isError ? <p role="alert" className="text-sm text-warning">{documents.error.message} <button className="cursor-pointer underline" onClick={() => void documents.refetch()}>Réessayer</button></p> : <ul data-testid="company-documents" className="space-y-2">{documents.data.length ? documents.data.map((document) => <li key={document.id}><a href={sourcePageUrl(document.id, 1)} target="_blank" rel="noreferrer" className="flex items-center gap-3 rounded-xl border border-border bg-surface p-4 transition hover:bg-soft"><FileText size={20} className="shrink-0 text-accent" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium">{document.originalName ?? document.kind}</span><span className="mt-1 block text-xs text-muted">{document.extractionPath === "pending" ? "Indexation en attente" : `${document.pageCount} page(s) indexée(s)`}</span></span><ArrowUpRight size={16} className="text-muted" /></a></li>) : <li className="rounded-xl border border-dashed border-border p-5 text-sm text-muted">Ajoutez votre premier document pour enrichir vos analyses.</li>}</ul>}
    {upload.isSuccess && <p role="status" className="text-sm text-positive">Document ajouté. Il sera disponible après son indexation.</p>}
    <UploadPanel key={uploadKey} kinds={COMPANY_DOCUMENT_KINDS} busy={upload.isPending} error={upload.isError ? upload.error.message : null} submitLabel="Ajouter le document" onSubmit={(files, kind) => upload.mutate({ file: files[0], kind }, { onSuccess: () => setUploadKey((key) => key + 1) })} />
  </section>;
}
