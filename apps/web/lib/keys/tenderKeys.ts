// Query key factory. Every query in the app gets its key from a factory like
// this, so an invalidation after a mutation cannot miss a key by typo.
export const tenderKeys = {
  all: ["tenders"] as const,
  lists: () => [...tenderKeys.all, "list"] as const,
  details: () => [...tenderKeys.all, "detail"] as const,
  detail: (id: string) => [...tenderKeys.details(), id] as const,
  requirements: (id: string) => [...tenderKeys.detail(id), "requirements"] as const,
  analysis: (id: string) => [...tenderKeys.detail(id), "analysis"] as const,
};
