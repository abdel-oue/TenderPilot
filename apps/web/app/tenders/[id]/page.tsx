// Tender detail. Server Component shell, client children for the interactive parts.
// TODO: verdict header (go / no-go + confidence)
// TODO: blockers list first - the blockers ARE the product
// TODO: requirements grouped by category, each row citing its page + article
// TODO: three states handled: loading skeleton, error, success

export default async function Page({ params }: PageProps<"/tenders/[id]">) {
  const { id } = await params;
  return (
    <main className="p-8">
      <h1 className="text-2xl font-semibold">Tender {id}</h1>
      <p className="text-sm opacity-70">TODO: verdict, blockers, requirements</p>
    </main>
  );
}
