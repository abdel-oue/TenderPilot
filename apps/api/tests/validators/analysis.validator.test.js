import { describe, expect, it } from 'vitest';
import { parseHumanAnswerBody } from '../../src/validators/analysis.validator.js';

// There is no type checker on this side, so a schema test with a malformed
// payload is the only thing asserting shape at all. The body here comes from a
// browser and decides whether a parked graph resumes and with what, so a bad one
// has to be rejected at the boundary rather than surface as `undefined` inside
// the resumed state.

describe('parseHumanAnswerBody', () => {
  it('accepts the two fields an answer always has', () => {
    expect(parseHumanAnswerBody({ askId: 'a1', choice: 'oui' })).toEqual({
      askId: 'a1',
      choice: 'oui',
    });
  });

  it('keeps the optional instruction, override and dismissals', () => {
    const answer = parseHumanAnswerBody({
      askId: 'a1',
      choice: 'oui',
      instruction: 'insistez sur nos references ferroviaires',
      verdictOverride: 'go',
      dismissedBlockers: ['q1', 'q2'],
    });

    expect(answer.instruction).toBe('insistez sur nos references ferroviaires');
    expect(answer.verdictOverride).toBe('go');
    expect(answer.dismissedBlockers).toEqual(['q1', 'q2']);
  });

  it('rejects a body with no choice', () => {
    expect(() => parseHumanAnswerBody({ askId: 'a1' })).toThrow(/choice/);
  });

  it('rejects a verdict override that is not a verdict', () => {
    // 'peut-etre' reaching the graph would be written straight into the result.
    expect(() => parseHumanAnswerBody({ askId: 'a1', choice: 'oui', verdictOverride: 'peut-etre' }))
      .toThrow(/verdictOverride/);
  });

  it('rejects an instruction long enough to be a payload rather than a sentence', () => {
    expect(() =>
      parseHumanAnswerBody({ askId: 'a1', choice: 'oui', instruction: 'x'.repeat(2001) }),
    ).toThrow(/instruction/);
  });

  it('rejects the shapes a caller gets wrong by accident', () => {
    expect(() => parseHumanAnswerBody(undefined)).toThrow();
    expect(() => parseHumanAnswerBody('oui')).toThrow();
    expect(() => parseHumanAnswerBody({ askId: 'a1', choice: 42 })).toThrow(/choice/);
    expect(() => parseHumanAnswerBody({ askId: '', choice: 'oui' })).toThrow(/askId/);
    expect(() => parseHumanAnswerBody({ askId: 'a1', choice: 'oui', dismissedBlockers: 'q1' }))
      .toThrow(/dismissedBlockers/);
  });
});
