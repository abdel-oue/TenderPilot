// Tender detail. Server Component shell, client child for the interactive parts.
import Link from "next/link";
import TenderDetail from "@/components/tenders/tenderDetail";

export default async function Page({ params }: PageProps<"/tenders/[id]">) {
  const { id } = await params;

  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-8">
      <Link className="cursor-pointer text-sm underline underline-offset-2" href="/tenders">
        ← Tous les dossiers
      </Link>
      <TenderDetail tenderId={id} />
    </main>
  );
}
