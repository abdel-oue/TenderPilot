"use client";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useTenders } from "@/hooks/useTenders";
import { TenderTable } from "./tenderTable";
import { DataFeedback } from "./dataFeedback";
import { PRIMARY } from "@/lib/utils/workspaceStyleUtils";
export function DossierLibrary() {
  const tenders = useTenders();
  return <main className="mx-auto max-w-7xl space-y-8 px-5 py-10 md:px-9"><header className="flex flex-wrap items-end justify-between gap-5"><div><p className="mb-2 text-mini font-semibold tracking-label text-muted uppercase">Vos opportunités</p><h1 className="font-heading text-4xl">Mes dossiers</h1><p className="mt-3 text-sm text-muted">Retrouvez, comparez et faites avancer vos appels d’offres.</p></div><Link href="/tenders/new" className={PRIMARY}><Plus size={17} /> Nouveau dossier</Link></header><DataFeedback pending={tenders.isPending} error={tenders.error} retry={() => void tenders.refetch()} />{tenders.data && !tenders.isError && <TenderTable tenders={tenders.data} />}</main>;
}
