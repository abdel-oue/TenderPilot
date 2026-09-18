"use client";
// EX-02: the compliance matrix. Every requirement, typed, with its source page.
//
// Eliminatory requirements sort first: the reader is looking for what can
// disqualify them, and making them scroll for it defeats the point.
import RequirementRow from "@/components/requirementRow";
import { Skeleton } from "@/components/ui/skeleton";
import { useRequirements } from "@/hooks/useTenders";

interface ComplianceMatrixProps {
  tenderId: string;
}

const ORDER = { eliminatoire: 0, obligatoire: 1, optionnelle: 2 } as const;

export default function ComplianceMatrix({ tenderId }: ComplianceMatrixProps) {
  const { data, isPending, isError, error } = useRequirements(tenderId);

  if (isPending) return <Skeleton className="h-64 w-full" />;
  if (isError) return <p className="text-sm text-no-go">{(error as Error).message}</p>;
  if (data.length === 0) {
    return (
      <p className="text-sm text-muted">
        Aucune exigence extraite. Lancez l&apos;analyse du dossier.
      </p>
    );
  }

  const rows = [...data].sort(
    (a, b) =>
      ORDER[a.obligation as keyof typeof ORDER] - ORDER[b.obligation as keyof typeof ORDER],
  );

  return (
    <table data-testid="compliance-matrix" className="w-full border-collapse text-left">
      <thead>
        <tr className="border-b border-border text-mini uppercase text-muted">
          <th className="px-3 py-2 font-medium">Exigence</th>
          <th className="px-3 py-2 font-medium">Type</th>
          <th className="px-3 py-2 font-medium">Source</th>
          <th className="px-3 py-2 font-medium">Profil</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((requirement) => (
          <RequirementRow key={requirement.id} requirement={requirement} />
        ))}
      </tbody>
    </table>
  );
}
