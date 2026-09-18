"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchCompany, importCompanyProfile } from "@/lib/api/company";
import { fetchCompanyDocuments, uploadCompanyDocument } from "@/lib/api/documents";
import { companyKeys } from "@/lib/keys/companyKeys";

export function useCompany() {
  return useQuery({ queryKey: companyKeys.profile(), queryFn: fetchCompany });
}

export function useCompanyDocuments() {
  return useQuery({ queryKey: companyKeys.documents(), queryFn: fetchCompanyDocuments });
}

export function useImportCompanyProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: importCompanyProfile,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: companyKeys.all }),
  });
}

/**
 * Uploading here is what makes a document citable: the api queues it for OCR and
 * embedding on arrival, which is what search_company_docs reads.
 */
export function useUploadCompanyDocument() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { file: File; kind: string }) =>
      uploadCompanyDocument(input.file, input.kind),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: companyKeys.documents() }),
  });
}
