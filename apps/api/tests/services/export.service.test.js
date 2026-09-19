import { inflateRawSync } from 'node:zlib';
import { describe, expect, it } from 'vitest';
import ExportService from '../../src/services/export.service.js';

/** Read an entry from the DOCX's ZIP central directory to check the exported text. */
function zipEntry(buffer, name) {
  for (let i = 0; i < buffer.length - 46; i++) {
    if (buffer.readUInt32LE(i) !== 0x02014b50) continue;
    const length = buffer.readUInt16LE(i + 28);
    if (buffer.subarray(i + 46, i + 46 + length).toString() !== name) continue;
    const offset = buffer.readUInt32LE(i + 42);
    const start = offset + 30 + buffer.readUInt16LE(offset + 26) + buffer.readUInt16LE(offset + 28);
    const compressed = buffer.subarray(start, start + buffer.readUInt32LE(i + 20));
    return (buffer.readUInt16LE(i + 10) === 8 ? inflateRawSync(compressed) : compressed).toString();
  }
  throw new Error('ZIP entry missing: ' + name);
}

describe('DOCX safeguards', () => {
  it('exports unresolved warnings, unread pages, and the exact human correction', async () => {
    const content = 'Human correction. '.repeat(40) + 'DO NOT CLAIM REF-99.';
    const service = new ExportService({
      analysisService: { findOwnedRun: async () => ({ tenderId: 't' }) },
      tenders: { findById: async () => ({ reference: 'JURY-TEST' }) },
      analyses: {
        findResultByRun: async () => ({ verdict: 'go', needsHuman: true, stageErrors: [{ node: 'compliance', message: 'Reviewer unavailable' }], unreadPages: [{ documentId: 'd', page: 47 }] }),
        findSections: async () => [{ sectionKey: 'technical', title: 'Methodologie', content, editedByHuman: true, needsHuman: true, complianceWarnings: ['Evidence missing'] }],
      },
    });
    const { buffer } = await service.exportDocx('run', 'owner');
    const xml = zipEntry(buffer, 'word/document.xml');
    for (const text of ['VERIFICATION HUMAINE REQUISE', 'Reviewer unavailable', 'p. 47', 'Evidence missing', 'DO NOT CLAIM REF-99.']) expect(xml).toContain(text);
  });
});
