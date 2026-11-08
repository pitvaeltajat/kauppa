import { describe, expect, it } from 'vitest';
import {
  parseQuestionDrafts,
  validateAndBuildAnswers,
  withEventQuestions,
  PARTICIPANT_NAME_QUESTION,
  type ItemQuestionLike,
} from '@/lib/questions';

const sizeQuestion: ItemQuestionLike = {
  id: 'q1',
  prompt: 'Hupparin koko',
  type: 'RADIO',
  required: true,
  options: ['S', 'M', 'L', 'XL'],
};
const nameQuestion: ItemQuestionLike = {
  id: 'q2',
  prompt: 'Nimikyltin teksti',
  type: 'TEXT',
  required: true,
  options: [],
};
const optionalNumber: ItemQuestionLike = {
  id: 'q3',
  prompt: 'Ikä (vuosina)',
  type: 'NUMBER',
  required: false,
  options: [],
};
const perks: ItemQuestionLike = {
  id: 'q4',
  prompt: 'Lisävarusteet',
  type: 'CHECKBOX',
  required: true,
  options: ['Pipo', 'Kassi'],
};

describe('validateAndBuildAnswers', () => {
  const questions = { itemA: [sizeQuestion, nameQuestion, optionalNumber], itemB: [perks] };

  it('builds snapshots for answered questions', () => {
    const result = validateAndBuildAnswers(questions, {
      itemA: { q1: 'L', q2: 'Aatu Vaelta', q3: '12' },
      itemB: { q4: ['Pipo'] },
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.snapshotsByItem.itemA).toEqual([
      { questionId: 'q1', prompt: 'Hupparin koko', type: 'RADIO', answer: 'L' },
      { questionId: 'q2', prompt: 'Nimikyltin teksti', type: 'TEXT', answer: 'Aatu Vaelta' },
      { questionId: 'q3', prompt: 'Ikä (vuosina)', type: 'NUMBER', answer: '12' },
    ]);
    expect(result.snapshotsByItem.itemB).toEqual([
      { questionId: 'q4', prompt: 'Lisävarusteet', type: 'CHECKBOX', answer: ['Pipo'] },
    ]);
  });

  it('requires a choice answer', () => {
    const result = validateAndBuildAnswers(questions, { itemA: { q2: 'x' }, itemB: {} });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('Hupparin koko');
  });

  it('rejects a choice not in the option list', () => {
    const result = validateAndBuildAnswers(questions, {
      itemA: { q1: 'XXL', q2: 'x' },
      itemB: { q4: ['Hattu'] },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('ei ole kelvollinen');
  });

  it('requires required free-text answers and allows optional empty ones', () => {
    const missingRequired = validateAndBuildAnswers(questions, {
      itemA: { q1: 'S' },
      itemB: { q4: ['Pipo'] },
    });
    expect(missingRequired.ok).toBe(false);
    if (!missingRequired.ok) expect(missingRequired.error).toContain('Nimikyltin teksti');

    const optionalSkipped = validateAndBuildAnswers(questions, {
      itemA: { q1: 'S', q2: 'x' },
      itemB: { q4: ['Pipo'] },
    });
    expect(optionalSkipped.ok).toBe(true);
    if (optionalSkipped.ok) {
      expect(
        optionalSkipped.snapshotsByItem.itemA.some((s) => s.questionId === 'q3'),
      ).toBe(false);
    }
  });

  it('rejects non-numeric input for NUMBER questions', () => {
    const result = validateAndBuildAnswers(questions, {
      itemA: { q1: 'S', q2: 'x', q3: 'kaksitoista' },
      itemB: { q4: ['Pipo'] },
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('numero');
  });

  it('accepts a missing answers map when nothing requires an answer', () => {
    const result = validateAndBuildAnswers({ empty: [] }, undefined);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.snapshotsByItem.empty).toEqual([]);
  });
});

describe('withEventQuestions', () => {
  it('prepends a mandatory participant name for events', () => {
    const result = withEventQuestions(true, [nameQuestion]);
    expect(result).toEqual([PARTICIPANT_NAME_QUESTION, nameQuestion]);
    expect(result[0].required).toBe(true);
  });

  it('leaves non-events untouched', () => {
    expect(withEventQuestions(false, [nameQuestion])).toEqual([nameQuestion]);
  });

  it('makes checkout reject an event without the participant name', () => {
    const questions = { evt: withEventQuestions(true, []) };
    expect(validateAndBuildAnswers(questions, { evt: {} }).ok).toBe(false);
    const ok = validateAndBuildAnswers(questions, { evt: { 'osallistujan-nimi': 'Aatu Vaelta' } });
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(ok.snapshotsByItem.evt[0].answer).toBe('Aatu Vaelta');
  });
});

describe('parseQuestionDrafts', () => {
  it('parses an admin question draft', () => {
    const result = parseQuestionDrafts(
      JSON.stringify([
        { prompt: 'Koko', type: 'RADIO', required: true, optionsText: 'S\nM\nL' },
        { prompt: 'Merkintä', type: 'TEXT', required: false, optionsText: '' },
      ]),
    );
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.questions).toEqual([
      { prompt: 'Koko', type: 'RADIO', required: true, options: ['S', 'M', 'L'] },
      { prompt: 'Merkintä', type: 'TEXT', required: false, options: [] },
    ]);
  });

  it('rejects a choice question without options', () => {
    const result = parseQuestionDrafts(
      JSON.stringify([{ prompt: 'Koko', type: 'RADIO', required: true, optionsText: '' }]),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('vaihtoehto');
  });

  it('rejects unknown types and empty prompts', () => {
    expect(parseQuestionDrafts(JSON.stringify([{ prompt: 'X', type: 'DATE', required: false, optionsText: '' }])).ok).toBe(false);
    expect(parseQuestionDrafts(JSON.stringify([{ prompt: '  ', type: 'TEXT', required: false, optionsText: '' }])).ok).toBe(false);
  });

  it('rejects malformed JSON', () => {
    const result = parseQuestionDrafts('{{ definitely not json');
    expect(result.ok).toBe(false);
  });
});
