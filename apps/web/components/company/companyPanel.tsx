"use client";
// "L'entreprise renseigne son profil une seule fois." One company per user, so
// there is no company picker here — the session already says whose it is.
import { useState } from "react";
import { COMPANY_DOCUMENT_KINDS } from "@tenderpilot/shared";
import UploadPanel from "@/components/tenders/uploadPanel";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useCompany,
  useCompanyDocuments,
  useImportCompanyProfile,
  useUploadCompanyDocument,
} from "@/hooks/useCompany";

export default function CompanyPanel() {
  const company = useCompany();
  const documents = useCompanyDocuments();
  const importProfile = useImportCompanyProfile();
  const upload = useUploadCompanyDocument();
  const [json, setJson] = useState("");

  if (company.isPending) return <Skeleton className="h-64 w-full" />;
  if (company.isError) {
    return <p className="text-sm text-no-go">{(company.error as Error).message}</p>;
  }

  const { profile, references, team } = company.data;

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide">Profil</h2>
        {profile ? (
          <div data-testid="company-profile" className="rounded-md border border-border bg-surface p-4 text-sm">
            <p className="font-semibold">{profile.raisonSociale}</p>
            <p className="text-muted">
              ICE {profile.ice} · {profile.siege} · {profile.effectif} personnes
            </p>
            <p className="mt-2 text-mini text-muted">
              {references.length} référence(s) · {team.length} CV ·{" "}
              {profile.certifications.join(", ") || "aucune certification"}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted">
              Aucun profil. Collez votre <code>profil-entreprise.json</code> pour commencer —
              sans lui, aucune exigence ne peut être confrontée à vos capacités.
            </p>
            <textarea
              data-testid="company-json"
              className="min-h-48 w-full rounded-md border border-border bg-background p-3 font-mono text-tiny"
              placeholder='{ "raison_sociale": "…", "ice": "…", "references": [...], "equipe": [...] }'
              value={json}
              onChange={(event) => setJson(event.target.value)}
            />
            <Button
              data-testid="company-import"
              variant="primary"
              onClick={() => {
                // Parsed here only to catch a typo before the round trip. The api
                // validates it properly, against the shared zod schema.
                try {
                  importProfile.mutate(JSON.parse(json));
                } catch {
                  /* invalid JSON: the error below covers it */
                }
              }}
            >
              {importProfile.isPending ? "Import…" : "Importer le profil"}
            </Button>
            {importProfile.isError ? (
              <p className="text-sm text-no-go">{(importProfile.error as Error).message}</p>
            ) : null}
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide">
          Documents de l&apos;entreprise
        </h2>
        <p className="text-sm text-muted">
          Attestations, mémoires déjà rendus, profil. Ce sont eux que le rédacteur fouille
          pour citer une référence réelle plutôt que d&apos;en inventer une.
        </p>
        <ul data-testid="company-documents" className="space-y-1 text-sm text-muted">
          {(documents.data ?? []).map((document) => (
            <li key={document.id}>
              {document.kind} · {document.originalName} ·{" "}
              {document.extractionPath === "pending"
                ? "indexation en attente"
                : `${document.pageCount} page(s) indexée(s)`}
            </li>
          ))}
        </ul>
        <UploadPanel
          kinds={COMPANY_DOCUMENT_KINDS}
          busy={upload.isPending}
          error={upload.isError ? (upload.error as Error).message : null}
          submitLabel="Ajouter un document"
          onSubmit={(files, kind) => upload.mutate({ file: files[0], kind })}
        />
      </section>
    </div>
  );
}
