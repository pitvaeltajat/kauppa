// Item checkout questions. Both halves are pure and unit-tested:
//
//  - validateAndBuildAnswers → buyer answers from the cart against the item's
//    questions, producing the snapshot stored on the order line.
//  - parseQuestionDrafts → the JSON the admin item form sends, into rows that
//    can be written to the database.

export const QUESTION_TYPES = ['TEXT', 'NUMBER', 'RADIO', 'CHECKBOX'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

/** The parts of an ItemQuestion the validation needs. */
export type ItemQuestionLike = {
  id: string;
  prompt: string;
  type: string;
  required: boolean;
  options: string[];
};

export type AnswerValue = string | string[];
export type AnswersByItem = Record<string, Record<string, AnswerValue>>;

export type AnswerSnapshot = {
  questionId: string;
  prompt: string;
  type: string;
  answer: string | string[];
};

export type BuildSnapshotsResult =
  | { ok: true; snapshotsByItem: Record<string, AnswerSnapshot[]> }
  | { ok: false; error: string };

function isChoiceType(type: string): type is 'RADIO' | 'CHECKBOX' {
  return type === 'RADIO' || type === 'CHECKBOX';
}

/**
 * Validates the buyer's answers for a set of items and builds the per-item
 * answer snapshots. Choice questions always require an answer; TEXT and NUMBER
 * only when `required`. Optional empty answers are dropped from the snapshot.
 */
export function validateAndBuildAnswers(
  questionsByItem: Record<string, ItemQuestionLike[]>,
  providedAnswers: AnswersByItem | undefined,
): BuildSnapshotsResult {
  const snapshotsByItem: Record<string, AnswerSnapshot[]> = {};
  const answers = providedAnswers ?? {};

  for (const [itemId, questions] of Object.entries(questionsByItem)) {
    const itemAnswers = answers[itemId] ?? {};
    const snapshots: AnswerSnapshot[] = [];

    for (const question of questions) {
      const raw = itemAnswers[question.id];

      if (isChoiceType(question.type)) {
        let value: AnswerValue;
        if (question.type === 'RADIO') {
          value = Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '');
        } else {
          value = Array.isArray(raw) ? raw.map(String) : raw === undefined || raw === '' ? [] : [String(raw)];
        }
        const values = Array.isArray(value) ? value : [value];
        if (values.length === 0 || values.some((v) => v === '')) {
          return { ok: false, error: `Valitse vaihtoehto kysymykseen "${question.prompt}".` };
        }
        for (const v of values) {
          if (!question.options.includes(v)) {
            return {
              ok: false,
              error: `"${v}" ei ole kelvollinen vaihtoehto kysymykseen "${question.prompt}".`,
            };
          }
        }
        snapshots.push({
          questionId: question.id,
          prompt: question.prompt,
          type: question.type,
          answer: question.type === 'RADIO' ? values[0] : values,
        });
        continue;
      }

      const value = typeof raw === 'string' ? raw.trim() : '';
      if (value === '') {
        if (question.required) {
          return { ok: false, error: `Vastaa kysymykseen "${question.prompt}".` };
        }
        continue;
      }
      if (question.type === 'NUMBER') {
        const number = Number(value.replace(',', '.'));
        if (!Number.isFinite(number)) {
          return {
            ok: false,
            error: `"${value}" ei ole kelvollinen vastaus kysymykseen "${question.prompt}" — anna numero.`,
          };
        }
      }
      snapshots.push({
        questionId: question.id,
        prompt: question.prompt,
        type: question.type,
        answer: value,
      });
    }

    snapshotsByItem[itemId] = snapshots;
  }

  return { ok: true, snapshotsByItem };
}

export type ParsedQuestion = {
  prompt: string;
  type: QuestionType;
  required: boolean;
  options: string[];
};

export type ParseDraftsResult =
  | { ok: true; questions: ParsedQuestion[] }
  | { ok: false; error: string };

/**
 * Parses the `questions` JSON field the admin item form posts:
 * [{ prompt, type, required, optionsText }]. optionsText is one option per
 * line and only used by RADIO/CHECKBOX.
 */
export function parseQuestionDrafts(rawJson: string): ParseDraftsResult {
  let raw: unknown;
  try {
    raw = JSON.parse(rawJson);
  } catch {
    return { ok: false, error: 'Kysymysten tiedot ovat virheelliset.' };
  }
  if (!Array.isArray(raw)) {
    return { ok: false, error: 'Kysymysten tiedot ovat virheelliset.' };
  }

  const questions: ParsedQuestion[] = [];
  for (const row of raw) {
    const candidate = row as {
      prompt?: unknown;
      type?: unknown;
      required?: unknown;
      optionsText?: unknown;
    };
    const prompt = typeof candidate.prompt === 'string' ? candidate.prompt.trim().slice(0, 200) : '';
    if (!prompt) return { ok: false, error: 'Kysymyksellä on oltava kysymysteksti.' };

    const type = typeof candidate.type === 'string' ? candidate.type : '';
    if (!QUESTION_TYPES.includes(type as QuestionType)) {
      return { ok: false, error: `Tuntematon kysymystyyppi "${type}".` };
    }

    const required = candidate.required === true;
    let options: string[] = [];
    if (isChoiceType(type)) {
      options = (typeof candidate.optionsText === 'string' ? candidate.optionsText : '')
        .split(/\r?\n/)
        .map((o) => o.trim())
        .filter(Boolean);
      if (options.length === 0) {
        return { ok: false, error: `Valintakysymykselle "${prompt}" tarvitaan vähintään yksi vaihtoehto.` };
      }
    }

    questions.push({ prompt, type: type as QuestionType, required, options });
  }
  return { ok: true, questions };
}
