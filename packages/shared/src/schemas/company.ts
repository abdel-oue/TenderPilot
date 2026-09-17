// zod schema for the company profile (profil-entreprise.json) + inferred type.
//
// TODO: companySchema - identity, capabilities, certifications,
//       references[] (stable ids REF-01..), team[] (stable ids CV-01..)
// TODO: referenceSchema, teamMemberSchema
// TODO: export type Company = z.infer<typeof companySchema>
//
// This schema is what validates the seed input, so it is strict on the stable ids.
