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

/**
 * Every event (isEvent) asks for the participant's name at checkout, always
 * required and always first - injected server-side (not a DB row) so it can't
 * be deleted and needs no backfill. The reserved id never collides with a cuid.
 */
export const PARTICIPANT_NAME_QUESTION: ItemQuestionLike = {
  id: 'osallistujan-nimi',
  prompt: 'Osallistujan nimi',
  type: 'TEXT',
  required: true,
  options: [],
};

/** Every event also asks for dietary restrictions and allergies. */
export const DIETARY_REQUIREMENTS_QUESTION: ItemQuestionLike = {
  id: 'erityisruokavaliot-ja-allergiat',
  prompt: 'Erityisruokavaliot ja allergiat (kirjoita "ei", jos niitä ei ole)',
  type: 'TEXT',
  required: false,
  options: [],
};

/** Prepends the mandatory participant-name question for events, else unchanged.
 * The cart renders every question once per unit of quantity. */
export function withEventQuestions<T extends ItemQuestionLike>(
  isEvent: boolean,
  questions: T[],
): (T | ItemQuestionLike)[] {
  return isEvent
    ? [PARTICIPANT_NAME_QUESTION, DIETARY_REQUIREMENTS_QUESTION, ...questions]
    : questions;
}

export type AnswerValue = string | string[];
/** Browser input can be a scalar for the original one-answer format, or an
 * array with one answer per unit in the cart. CHECKBOX uses string[] per unit. */
export type AnswerInput = string | string[] | Array<string | string[]>;
export type AnswersByItem = Record<string, Record<string, AnswerInput>>;

export type AnswerSnapshot = {
  questionId: string;
  prompt: string;
  type: string;
  answer: string | string[];
};

export type ParticipantAnswerRow = {
  name: string;
  answers: AnswerSnapshot[];
};

/** Split an event line's snapshot into one row per purchased participant. */
export function splitParticipantAnswers(
  quantity: number,
  snapshots: AnswerSnapshot[],
): ParticipantAnswerRow[] {
  const count = Math.max(1, quantity);
  const participantSnapshot = snapshots.find(
    (snapshot) => snapshot.questionId === PARTICIPANT_NAME_QUESTION.id,
  );
  const names = participantSnapshot
    ? Array.isArray(participantSnapshot.answer)
      ? participantSnapshot.answer
      : [participantSnapshot.answer]
    : [];

  return Array.from({ length: count }, (_, participantIndex) => {
    const suffix = ` ${participantIndex + 1}`;
    const answers = snapshots
      .filter((snapshot) => snapshot !== participantSnapshot)
      .flatMap((snapshot) => {
        if (count === 1) return [snapshot];
        if (snapshot.prompt.endsWith(suffix)) {
          return [{ ...snapshot, prompt: snapshot.prompt.slice(0, -suffix.length) }];
        }
        return snapshot.prompt.match(/ \d+$/) ? [] : participantIndex === 0 ? [snapshot] : [];
      });

    return {
      name: names[participantIndex] ?? `Osallistuja ${participantIndex + 1}`,
      answers,
    };
  });
}

export type BuildSnapshotsResult =
  { ok: true; snapshotsByItem: Record<string, AnswerSnapshot[]> } | { ok: false; error: string };

function isChoiceType(type: string): type is 'RADIO' | 'CHECKBOX' {
  return type === 'RADIO' || type === 'CHECKBOX';
}

export type ParticipantResult =
  { ok: true; snapshot: AnswerSnapshot | null } | { ok: false; error: string };

/**
 * One participant name per unit bought (quantity) for an event line, all
 * required. Returns the snapshot to prepend to the line's answers, or null for
 * a non-event. `raw` is whatever the cart sent for the participant field.
 */
export function buildParticipantNames(
  isEvent: boolean,
  quantity: number,
  raw: unknown,
): ParticipantResult {
  if (!isEvent) return { ok: true, snapshot: null };
  const list = Array.isArray(raw) ? raw : raw === undefined ? [] : [raw];
  const names: string[] = [];
  for (let i = 0; i < quantity; i++) {
    const name = typeof list[i] === 'string' ? (list[i] as string).trim() : '';
    if (!name) return { ok: false, error: 'Anna jokaisen osallistujan nimi.' };
    names.push(name.slice(0, 200));
  }
  return {
    ok: true,
    snapshot: {
      questionId: PARTICIPANT_NAME_QUESTION.id,
      prompt: PARTICIPANT_NAME_QUESTION.prompt,
      type: 'TEXT',
      answer: names,
    },
  };
}

/**
 * Validates the buyer's answers for a set of items and builds the per-item
 * answer snapshots. Choice questions always require an answer; TEXT and NUMBER
 * only when `required`. Optional empty answers are dropped from the snapshot.
 */
export function validateAndBuildAnswers(
  questionsByItem: Record<string, ItemQuestionLike[]>,
  providedAnswers: AnswersByItem | undefined,
  quantityByItem: Record<string, number> = {},
): BuildSnapshotsResult {
  const snapshotsByItem: Record<string, AnswerSnapshot[]> = {};
  const answers = providedAnswers ?? {};

  for (const [itemId, questions] of Object.entries(questionsByItem)) {
    const itemAnswers = answers[itemId] ?? {};
    const snapshots: AnswerSnapshot[] = [];
    const quantity = Math.max(1, quantityByItem[itemId] ?? 1);

    for (let participantIndex = 0; participantIndex < quantity; participantIndex++) {
      for (const question of questions) {
        const raw = answerForParticipant(
          question.type,
          itemAnswers[question.id],
          participantIndex,
          quantity,
        );
        const participantLabel = quantity > 1 ? ` ${participantIndex + 1}` : '';

        if (isChoiceType(question.type)) {
          let value: AnswerValue;
          if (question.type === 'RADIO') {
            value = Array.isArray(raw) ? (raw[0] ?? '') : (raw ?? '');
          } else {
            value = Array.isArray(raw)
              ? raw.map(String)
              : raw === undefined || raw === ''
                ? []
                : [String(raw)];
          }
          const values = Array.isArray(value) ? value : [value];
          if (values.length === 0 || values.some((v) => v === '')) {
            return {
              ok: false,
              error: `Valitse vastaus kysymykseen "${question.prompt}"${participantLabel}.`,
            };
          }
          for (const v of values) {
            if (!question.options.includes(v)) {
              return {
                ok: false,
                error: `"${v}" ei ole kelvollinen vastaus kysymykseen "${question.prompt}"${participantLabel}.`,
              };
            }
          }
          snapshots.push({
            questionId: question.id,
            prompt: `${question.prompt}${participantLabel}`,
            type: question.type,
            answer: question.type === 'RADIO' ? values[0] : values,
          });
          continue;
        }

        const value = typeof raw === 'string' ? raw.trim() : '';
        if (value === '') {
          if (question.required) {
            return {
              ok: false,
              error: `Vastaa kysymykseen "${question.prompt}"${participantLabel}.`,
            };
          }
          continue;
        }
        if (question.type === 'NUMBER') {
          const number = Number(value.replace(',', '.'));
          if (!Number.isFinite(number)) {
            return {
              ok: false,
              error: `Anna kysymykseen "${question.prompt}"${participantLabel} numero.`,
            };
          }
        }
        snapshots.push({
          questionId: question.id,
          prompt: `${question.prompt}${participantLabel}`,
          type: question.type,
          answer: value,
        });
      }
    }

    snapshotsByItem[itemId] = snapshots;
  }

  return { ok: true, snapshotsByItem };
}

function answerForParticipant(
  type: string,
  raw: AnswerInput | undefined,
  participantIndex: number,
  quantity: number,
): AnswerValue {
  if (quantity === 1) {
    if (raw === undefined) return '';
    // The cart always sends one answer slot per unit, so a single unit arrives
    // as a one-element array (CHECKBOX as an array of option arrays). Unwrap it
    // instead of handing the array to the scalar TEXT/NUMBER validation.
    if (!Array.isArray(raw)) return raw;
    if (raw.some(Array.isArray)) return (raw[0] as AnswerValue | undefined) ?? [];
    if (type === 'CHECKBOX') return raw as string[];
    return typeof raw[0] === 'string' ? raw[0] : '';
  }

  if (!Array.isArray(raw)) return '';
  if (type === 'CHECKBOX') {
    return Array.isArray(raw[participantIndex]) ? raw[participantIndex] : [];
  }
  return typeof raw[participantIndex] === 'string' ? raw[participantIndex] : '';
}

export type ParsedQuestion = {
  prompt: string;
  type: QuestionType;
  required: boolean;
  options: string[];
};

export type ParseDraftsResult =
  { ok: true; questions: ParsedQuestion[] } | { ok: false; error: string };

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
    const prompt =
      typeof candidate.prompt === 'string' ? candidate.prompt.trim().slice(0, 200) : '';
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
        return {
          ok: false,
          error: `Valintakysymykselle "${prompt}" tarvitaan vähintään yksi vaihtoehto.`,
        };
      }
    }

    questions.push({ prompt, type: type as QuestionType, required, options });
  }
  return { ok: true, questions };
}
