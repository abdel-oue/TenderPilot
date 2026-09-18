import CompanyPanel from "@/components/company/companyPanel";
export const metadata = { title: "Mon entreprise — TenderPilot" };
export default function Page() {
  return <main className="mx-auto max-w-5xl space-y-8 px-5 py-10 md:px-9"><header><p className="mb-2 text-mini font-semibold tracking-label text-muted uppercase">Votre base de connaissances</p><h1 className="font-heading text-4xl">Mon entreprise</h1><p className="mt-3 text-sm leading-6 text-muted">Vos capacités, vos références et vos documents. Le point de départ de chaque analyse.</p></header><CompanyPanel /></main>;
}
