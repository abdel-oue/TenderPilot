// Tender detail. Server Component shell, client child for the interactive parts.
import Link from "next/link";
import TenderDetail from "@/components/tenders/tenderDetail";

export default async function Page({ params }: PageProps<"/tenders/[id]">) {
  const { id } = await params;

  return (
    <main className="mx-auto w-full max-w-screen-2xl space-y-5 px-5 pb-10 pt-3 md:px-9">
      <Link className="cursor-pointer text-sm underline underline-offset-2" href="/tenders">
        ← Tous les dossiers
      </Link>
      <TenderDetail tenderId={id} />
    </main>
  );
}
