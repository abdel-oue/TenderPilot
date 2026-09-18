"use client";
import { useRef, useState } from "react";
import { FileText, Loader2, UploadCloud, X } from "lucide-react";
import { INPUT, PRIMARY } from "@/lib/utils/workspaceStyleUtils";
import { cn } from "@/lib/utils/classNameUtils";
interface UploadPanelProps {
  kinds: readonly string[]; multiple?: boolean; busy: boolean; error?: string | null;
  submitLabel: string; onSubmit: (files: File[], kind: string) => void; children?: React.ReactNode;
}
const KIND_LABELS: Record<string, string> = { avis: "Avis d’appel d’offres", cps: "Cahier des prescriptions spéciales", reglement: "Règlement de consultation", bpu: "Bordereau des prix", planning: "Planning", attestation: "Attestation", memoire: "Mémoire technique", profil: "Profil entreprise" };
export default function UploadPanel({ kinds, multiple = false, busy, error, submitLabel, onSubmit, children }: UploadPanelProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [kind, setKind] = useState(kinds[0]);
  const [dragging, setDragging] = useState(false);
  const [validation, setValidation] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  function selectFiles(selected: File[]) {
    if (busy) return;
    if (selected.some((file) => !file.name.toLowerCase().endsWith(".pdf"))) { setValidation("Choisissez uniquement des fichiers PDF."); return; }
    if (!multiple && selected.length > 1) { setValidation("Ajoutez un seul document à la fois."); return; }
    setValidation(null);
    setFiles(selected);
  }
  return <div data-testid="upload-panel" className="space-y-6 rounded-2xl border border-border bg-surface p-5 md:p-7">
    {children}
    <label className="block space-y-2 text-sm font-medium">Type de document<select aria-label="Type de document" data-testid="upload-kind" className={cn(INPUT, "cursor-pointer")} value={kind} disabled={busy} onChange={(event) => setKind(event.target.value)}>{kinds.map((value) => <option key={value} value={value}>{KIND_LABELS[value] ?? value}</option>)}</select></label>
    <div onDragOver={(event) => { event.preventDefault(); if (!busy) setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); selectFiles(Array.from(event.dataTransfer.files)); }} className={cn("relative rounded-xl border-2 border-dashed p-8 text-center transition duration-200", dragging ? "border-accent bg-accent-soft" : "border-border bg-background")}>
      <UploadCloud size={30} strokeWidth={1.4} className="mx-auto text-accent" /><p className="mt-3 text-sm font-medium">Glissez vos PDF ici</p><p className="mt-2 text-xs text-muted">ou cliquez pour choisir {multiple ? "vos fichiers" : "un fichier"}</p>
      <input ref={input} data-testid="upload-input" type="file" aria-label="Choisir les documents PDF" accept=".pdf,application/pdf" multiple={multiple} disabled={busy} className="absolute inset-0 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed" onChange={(event) => selectFiles(Array.from(event.target.files ?? []))} />
    </div>
    {files.length > 0 && <ul className="space-y-2">{files.map((file, index) => <li key={`${file.name}-${index}`} className="flex items-center gap-3 rounded-xl bg-soft px-4 py-3 text-xs"><FileText size={17} className="shrink-0 text-accent" /><span className="min-w-0 flex-1 truncate">{file.name}</span><span className="text-muted">{Math.max(1, Math.round(file.size / 1024))} Ko</span><button disabled={busy} className="cursor-pointer rounded p-1 hover:bg-surface" aria-label={`Retirer ${file.name}`} onClick={() => { setFiles(files.filter((_, position) => position !== index)); if (input.current) input.current.value = ""; }}><X size={15} /></button></li>)}</ul>}
    {(validation || error) && <p data-testid="upload-error" role="alert" className="rounded-xl bg-warning-soft p-3 text-sm text-warning">{validation || error}</p>}
    <div className="flex flex-wrap items-center justify-between gap-4 border-t border-border pt-5"><p className="text-xs text-muted">{files.length ? `${files.length} fichier(s) prêt(s) à envoyer` : "Documents PDF uniquement"}</p><button data-testid="upload-submit" className={PRIMARY} disabled={busy || !files.length} onClick={() => { if (!busy && files.length) onSubmit(files, kind); }}>{busy ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}{busy ? "Envoi en cours…" : submitLabel}</button></div>
  </div>;
}
