export const companyKeys = {
  all: ["company"] as const,
  profile: () => [...companyKeys.all, "profile"] as const,
  documents: () => [...companyKeys.all, "documents"] as const,
};
