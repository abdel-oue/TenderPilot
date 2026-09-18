import { z } from 'zod';

// Which kinds belong to a DOSSIER and which belong to the COMPANY. The split is
// not cosmetic: a tender document is what gets analysed, a company document is
// what the Writer searches to cite a real reference (search_company_docs).
export const TENDER_DOCUMENT_KINDS = ['avis', 'cps', 'reglement', 'bpu', 'planning'];
export const COMPANY_DOCUMENT_KINDS = ['attestation', 'memoire', 'profil'];
export const DOCUMENT_KINDS = [...TENDER_DOCUMENT_KINDS, ...COMPANY_DOCUMENT_KINDS];

export const documentSchema = z.object({
  id: z.string(),
  kind: z.enum(DOCUMENT_KINDS),
  originalName: z.string().nullable(),
  pageCount: z.number().int(),
  // pending until the ingest node has read it; then text_layer | ocr | mixed.
  extractionPath: z.string(),
  createdAt: z.string().nullable().optional(),
});

export const tenderDocumentKindSchema = z.enum(TENDER_DOCUMENT_KINDS);
export const companyDocumentKindSchema = z.enum(COMPANY_DOCUMENT_KINDS);

/** @typedef {import('zod').infer<typeof documentSchema>} Document */
