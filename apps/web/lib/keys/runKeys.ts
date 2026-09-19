// Query key factory for the Contrôle screen. Runs are keyed on their own id and
// not under tenderKeys: the list crosses every dossier, and invalidating one
// dossier must not drop the whole history.
export const runKeys = {
  all: ["runs"] as const,
  lists: () => [...runKeys.all, "list"] as const,
  details: () => [...runKeys.all, "detail"] as const,
  detail: (runId: string) => [...runKeys.details(), runId] as const,
};
