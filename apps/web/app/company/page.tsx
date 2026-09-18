// The company: profile imported once, plus the corpus the Writer cites from.
import Link from "next/link";
import CompanyPanel from "@/components/company/companyPanel";

export const metadata = { title: "Mon entreprise — TenderPilot" };

export default function Page() {
  return (
    <main className="mx-auto w-full max-w-5xl space-y-6 p-8">
      <Link className="cursor-pointer text-sm underline underline-offset-2" href="/tenders">
        ← Tous les dossiers
      </Link>
      <h1 className="font-heading text-3xl">Mon entreprise</h1>
      <CompanyPanel />
    </main>
  );
}
