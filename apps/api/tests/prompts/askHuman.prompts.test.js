import { describe, expect, it } from 'vitest';
import {
  ASK_HUMAN_DESCRIPTION,
  ASK_HUMAN_OPTIONS,
  ASK_HUMAN_QUESTION,
} from '../../src/prompts/askHuman.prompts.js';

// A weak assertion on purpose: it cannot prove the model behaves, it only stops
// a rewrite from silently dropping half the instruction.
describe('ASK_HUMAN_DESCRIPTION', () => {
  it('names the three families that make the tool fire', () => {
    expect(ASK_HUMAN_DESCRIPTION).toMatch(/expiree/);
    expect(ASK_HUMAN_DESCRIPTION).toMatch(/13 ans/);
    expect(ASK_HUMAN_DESCRIPTION).toMatch(/non jointe/);
  });

  it('frames the trigger as an arbitration, not a missing fact', () => {
    expect(ASK_HUMAN_DESCRIPTION).toMatch(/no-go/);
  });

  it('redirects the questions another tool answers', () => {
    const redirected = ['get_company_facts', 'check_dossier_checklist', 'read_source_page']
      .filter((tool) => ASK_HUMAN_DESCRIPTION.includes(tool));
    expect(redirected.length).toBeGreaterThanOrEqual(2);
  });
});

describe('ASK_HUMAN_QUESTION and ASK_HUMAN_OPTIONS', () => {
  it('requires the question to carry what is at stake', () => {
    expect(ASK_HUMAN_QUESTION).toMatch(/ENJEU/);
  });

  it('asks for the outcomes of the arbitration, not yes/no', () => {
    expect(ASK_HUMAN_OPTIONS).toMatch(/eliminatoire/);
    expect(ASK_HUMAN_OPTIONS).toMatch(/risque_note/);
  });
});
