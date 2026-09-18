// EX-07: pages the pipeline could not read, said out loud.
//
// This banner is not decoration. A scan the OCR could not resolve produces no
// requirements, and without this the screen is indistinguishable from "this
// dossier demands nothing" — which is the silent failure the cahier des charges
// forbids in so many words.
import { sourcePageUrl } from "@/lib/api/documents";

interface UnreadPagesBannerProps {
  unreadPages: { documentId: string; page: number }[];
}

export default function UnreadPagesBanner({ unreadPages }: UnreadPagesBannerProps) {
  if (unreadPages.length === 0) return null;

  return (
    <div
      data-testid="unread-banner"
      className="rounded-md border border-no-go/40 bg-warning-soft p-4 text-sm text-foreground"
    >
      <p className="font-semibold text-no-go">
        {unreadPages.length} page(s) illisible(s) — aucune exigence n&apos;en a été déduite.
      </p>
      <p className="mt-1 text-muted">
        Ces pages sont des scans que l&apos;OCR n&apos;a pas pu résoudre. Vérifiez-les
        vous-même avant de vous fier au verdict.
      </p>
      <ul className="mt-2 flex flex-wrap gap-2">
        {unreadPages.map((entry) => (
          <li key={`${entry.documentId}-${entry.page}`}>
            <a
              className="cursor-pointer underline underline-offset-2"
              href={sourcePageUrl(entry.documentId, entry.page)}
              target="_blank"
              rel="noreferrer"
            >
              page {entry.page}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
