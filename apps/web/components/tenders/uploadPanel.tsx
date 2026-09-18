"use client";
// EX-01: drop a PDF from the interface.
//
// A native <input type="file"> and a button. No dropzone library, no <form
// onSubmit> — the file input is the platform feature that already does this.
import { useState } from "react";
import { Button } from "@/components/ui/button";

interface UploadPanelProps {
  kinds: readonly string[];
  /** Multiple files for a dossier (avis + CPS + règlement), one for the rest. */
  multiple?: boolean;
  busy: boolean;
  error?: string | null;
  submitLabel: string;
  onSubmit: (files: File[], kind: string) => void;
  /** Rendered above the file input — the reference field, on the dossier form. */
  children?: React.ReactNode;
}

export default function UploadPanel({
  kinds,
  multiple = false,
  busy,
  error,
  submitLabel,
  onSubmit,
  children,
}: UploadPanelProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [kind, setKind] = useState(kinds[0]);

  return (
    <div data-testid="upload-panel" className="space-y-3 rounded-md border border-border bg-surface p-4">
      {children}

      <div className="flex flex-wrap items-center gap-3">
        <select
          data-testid="upload-kind"
          className="cursor-pointer rounded-md border border-border bg-background px-3 py-2 text-sm"
          value={kind}
          onChange={(event) => setKind(event.target.value)}
        >
          {kinds.map((value) => (
            <option key={value} value={value}>
              {value}
            </option>
          ))}
        </select>

        <input
          data-testid="upload-input"
          type="file"
          accept="application/pdf"
          multiple={multiple}
          className="cursor-pointer text-sm"
          onChange={(event) => setFiles(Array.from(event.target.files ?? []))}
        />

        <Button
          data-testid="upload-submit"
          variant="primary"
          onClick={() => files.length > 0 && onSubmit(files, kind)}
        >
          {busy ? "Envoi…" : submitLabel}
        </Button>
      </div>

      {files.length > 0 ? (
        <p className="text-mini text-muted">{files.map((file) => file.name).join(", ")}</p>
      ) : null}

      {error ? (
        <p data-testid="upload-error" className="text-sm text-no-go">
          {error}
        </p>
      ) : null}
    </div>
  );
}
