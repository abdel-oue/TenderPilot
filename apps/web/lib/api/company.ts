// Fetch wrappers for the company. One company per user: there is no id in any of
// these paths, because the session already says whose company it is.
import { request } from "./client";

export interface CompanyProfile {
  ice: string;
  raisonSociale: string;
  siege: string;
  effectif: number;
  certifications: string[];
  secteurs: string[];
}

export interface CompanyBundle {
  profile: CompanyProfile | null;
  references: { id: string; client: string; secteur: string; objet: string }[];
  team: {
    id: string;
    initiales: string;
    poste: string;
    anneesExperience: number;
    diplome: string;
    certifications: string[];
    langues: string[];
  }[];
}

export async function fetchCompany(): Promise<CompanyBundle> {
  return (await request("/company")) as CompanyBundle;
}

/** Imports a profil-entreprise JSON. Validated api-side against the shared schema. */
export async function importCompanyProfile(profile: unknown) {
  return (await request("/company/profile", { body: profile })) as {
    references: number;
    team: number;
  };
}
