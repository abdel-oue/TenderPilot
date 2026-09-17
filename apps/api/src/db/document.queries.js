// ALL document + chunk SQL. Drizzle query builder only.
//
// TODO: findByContentHash(hash) - the cache lookup, called before any parse
// TODO: insertDocument(values)
// TODO: insertChunks(rows)
// TODO: searchSimilarChunks(tenderId, embedding, k)
//       Raw sql`` is allowed HERE and only here, with a comment saying why:
//       pgvector <=> distance is not expressible in the Drizzle query builder.
