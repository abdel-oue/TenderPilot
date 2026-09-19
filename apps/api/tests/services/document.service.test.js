import { beforeEach, describe, expect, it, vi } from 'vitest';

// saveUpload writes bytes to disk and hashes them. Stubbed: what is under test
// is what happens to the row afterwards, not the filesystem.
vi.mock('../../src/lib/uploads.js', () => ({
  MAX_UPLOAD_BYTES: 1,
  saveUpload: async () => ({ filePath: '/tmp/abc.pdf', contentHash: 'abc' }),
}));

const { default: DocumentService } = await import('../../src/services/document.service.js');

/** Captures what was queued. The queue's job here is to be called, not to run. */
function fakeQueue() {
  const added = [];
  return { added, async add(name, payload, options) { added.push({ name, payload, options }); } };
}

let queue;
let service;

beforeEach(() => {
  queue = fakeQueue();
  service = new DocumentService({
    documents: { async upsert(values) { return { id: 'doc-1', ...values }; } },
    queue,
  });
});

/** @param {string|null} tenderId @returns {Promise<void>} */
function upload(tenderId) {
  return service.upload({
    buffer: Buffer.from('%PDF-1.4'),
    originalName: 'cps.pdf',
    kind: tenderId ? 'cps' : 'attestation',
    ownerId: 'owner-1',
    tenderId,
  });
}

describe('DocumentService.upload', () => {
  it('queues a dossier document for indexing, so its chunks get an embedding', async () => {
    await upload('tender-1');
    expect(queue.added).toHaveLength(1);
    expect(queue.added[0].payload.document.tenderId).toBe('tender-1');
  });

  it('still queues a company document', async () => {
    await upload(null);
    expect(queue.added).toHaveLength(1);
    expect(queue.added[0].payload.document.tenderId).toBeNull();
  });

  it('keys the job on the document id, so a re-upload does not index twice', async () => {
    await upload('tender-1');
    expect(queue.added[0].options.jobId).toContain('doc-1');
  });
});
