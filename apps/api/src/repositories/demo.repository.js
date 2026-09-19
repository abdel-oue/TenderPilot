/**
 * Demo Repository
 * ALL the SQL that clones one owner's workspace onto another.
 *
 * One file rather than a `copyForDemo` bolted onto each of the five entity
 * repositories: this is a single operation with one caller (the demo endpoint),
 * and splitting it across company/tender/document would hide the one thing that
 * actually matters here - that the whole clone is one transaction, so a visitor
 * can never land in a half-populated workspace.
 *
 * It copies rather than re-seeds because the expensive part of the seed is not
 * the rows, it is the OCR and the embeddings behind them. `document_chunks`
 * comes across vectors and all, so a demo costs no quota and no minutes.
 */
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/client.js';
import {
  companyProfile,
  companyReferences,
  documentChunks,
  documents,
  tenders,
  teamMembers,
  users,
} from '../db/schema/index.js';

// Demo accounts are minted under this shape, and it is what tells them apart
// from a real signup when the time comes to reap them.
export const DEMO_EMAIL_PREFIX = 'demo-';
export const DEMO_EMAIL_DOMAIN = '@tenderpilot.local';
const DEMO_TTL_HOURS = 24;

export default class DemoRepository {
  /** @param {object} [database] injectable for tests */
  constructor(database = db) {
    this.db = database;
  }

  /**
   * Clones every row `fromOwnerId` owns onto `toOwnerId`, in one transaction.
   *
   * Ids are regenerated for tenders and documents (they are uuid primary keys),
   * which is why those two are copied row by row with a map rather than in one
   * INSERT … SELECT: a document has to point at the NEW tender, and a chunk at
   * the NEW document. The company tables need no such thing - their keys are
   * (owner_id, 'REF-01') pairs, so a plain INSERT … SELECT is enough.
   *
   * Analysis runs are NOT copied, so every dossier comes back to 'pending': a
   * dossier marked 'analyzed' with no run behind it is a row whose detail screen
   * has nothing to show. The visitor launches their own analysis, which is the
   * thing worth demonstrating anyway.
   *
   * @param {string} fromOwnerId the seeded account
   * @param {string} toOwnerId the freshly minted demo account
   * @returns {Promise<{ references: number, team: number, tenders: number, documents: number, chunks: number }>}
   */
  async cloneWorkspace(fromOwnerId, toOwnerId) {
    return this.db.transaction(async (tx) => {
      const tally = { references: 0, team: 0, tenders: 0, documents: 0, chunks: 0 };

      const [profile] = await tx
        .select()
        .from(companyProfile)
        .where(eq(companyProfile.ownerId, fromOwnerId));
      if (profile) await tx.insert(companyProfile).values({ ...profile, ownerId: toOwnerId });

      const references = await tx
        .select()
        .from(companyReferences)
        .where(eq(companyReferences.ownerId, fromOwnerId));
      if (references.length) {
        await tx
          .insert(companyReferences)
          .values(references.map((row) => ({ ...row, ownerId: toOwnerId })));
        tally.references = references.length;
      }

      const team = await tx.select().from(teamMembers).where(eq(teamMembers.ownerId, fromOwnerId));
      if (team.length) {
        await tx.insert(teamMembers).values(team.map((row) => ({ ...row, ownerId: toOwnerId })));
        tally.team = team.length;
      }

      const sourceTenders = await tx.select().from(tenders).where(eq(tenders.ownerId, fromOwnerId));
      const tenderIds = new Map();
      for (const tender of sourceTenders) {
        const { id, ownerId, createdAt, status, ...rest } = tender;
        const [copy] = await tx
          .insert(tenders)
          .values({ ...rest, ownerId: toOwnerId, status: 'pending' })
          .returning({ id: tenders.id });
        tenderIds.set(id, copy.id);
      }
      tally.tenders = sourceTenders.length;

      const sourceDocuments = await tx
        .select()
        .from(documents)
        .where(eq(documents.ownerId, fromOwnerId));
      for (const document of sourceDocuments) {
        const { id, ownerId, createdAt, tenderId, ...rest } = document;
        const [copy] = await tx
          .insert(documents)
          .values({ ...rest, ownerId: toOwnerId, tenderId: tenderId ? tenderIds.get(tenderId) : null })
          .returning({ id: documents.id });
        // Raw SQL: the pgvector column cannot be round-tripped through a select
        // and back, and there is no reason to pull a few thousand 512-float
        // vectors into Node only to send them straight back.
        const inserted = await tx.execute(sql`
          insert into ${documentChunks} (document_id, page, article, content, extraction, embedding)
          select ${copy.id}, page, article, content, extraction, embedding
          from ${documentChunks} where document_id = ${id}
        `);
        tally.chunks += inserted.count ?? 0;
      }
      tally.documents = sourceDocuments.length;

      return tally;
    });
  }

  /**
   * Reaps expired demo accounts. Their rows cascade, so this is the whole
   * cleanup - no cron, no job, just the next visitor paying for the last one.
   *
   * FILTERED on both the minted email shape and the age, so it can never reach a
   * real account. The seeded `demo@tenderpilot.local` does not match the prefix.
   *
   * @returns {Promise<number>} how many were removed
   */
  async deleteExpiredDemoUsers() {
    const result = await this.db
      .delete(users)
      .where(
        sql`${users.email} like ${DEMO_EMAIL_PREFIX + '%' + DEMO_EMAIL_DOMAIN}
            and ${users.createdAt} < now() - interval '${sql.raw(String(DEMO_TTL_HOURS))} hours'`,
      )
      .returning({ id: users.id });
    return result.length;
  }
}
