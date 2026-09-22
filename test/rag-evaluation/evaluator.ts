import { INSUFFICIENT_INFORMATION_ANSWER } from '../../src/ai/rag/grounding-prompt';
import type {
  RagEvaluationCase,
  RagEvaluationCaseResult,
  RagEvaluationClassification,
  SeededRagEvaluationCorpus,
} from './types';
import type { RagAnswer } from '../../src/ai/rag/rag.service';
import type { RetrievedChunk } from '../../src/ai/rag/retrieval/retrieval.service';

export interface EvaluationObservation {
  answer: RagAnswer;
  retrieved: RetrievedChunk[];
  retrievalDurationMs: number;
  generationDurationMs: number | null;
  totalDurationMs: number;
  observedModel: string | null;
}

export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function evaluateCase(
  evaluationCase: RagEvaluationCase,
  observation: EvaluationObservation,
  corpus: SeededRagEvaluationCorpus,
): RagEvaluationCaseResult {
  const expectedChunkIds = new Set(
    evaluationCase.expectedEvidenceKeys.map((key) => {
      const chunkId = corpus.chunkIdsByEvidenceKey.get(key);
      if (chunkId === undefined)
        throw new Error(`Evidence was not seeded: ${key}`);
      return chunkId;
    }),
  );
  const firstRelevantIndex = observation.retrieved.findIndex(({ id }) =>
    expectedChunkIds.has(id),
  );
  const normalizedAnswer = normalizeText(observation.answer.answer);
  const requiredAnswerTermGroupsPresent = groupsPresent(
    evaluationCase.requiredAnswerTermGroups,
    normalizedAnswer,
  );
  const requiredLimitationTermGroupsPresent = groupsPresent(
    evaluationCase.requiredLimitationTermGroups ?? [],
    normalizedAnswer,
  );
  const forbiddenTermsPresent = evaluationCase.forbiddenTerms.filter((term) =>
    normalizedAnswer.includes(normalizeText(term)),
  );
  const normalizedInsufficiencyAnswer = normalizeText(
    INSUFFICIENT_INFORMATION_ANSWER,
  );
  const abstained = normalizedAnswer === normalizedInsufficiencyAnswer;
  const containsInsufficiencyStatement = normalizedAnswer.includes(
    normalizedInsufficiencyAnswer,
  );
  const answerEmpty = observation.answer.answer.trim().length === 0;
  const sourceChunkIds = observation.answer.sources.map(
    ({ chunkId }) => chunkId,
  );
  const expectedSourcePresent =
    expectedChunkIds.size === 0
      ? null
      : sourceChunkIds.some((id) => expectedChunkIds.has(id));
  const expectedBehaviorSatisfied = behaviorIsSatisfied({
    evaluationCase,
    answerEmpty,
    abstained,
    containsInsufficiencyStatement,
    requiredAnswerTermGroupsPresent,
    requiredLimitationTermGroupsPresent,
  });
  const diagnostics: string[] = [];

  if (expectedChunkIds.size > 0 && firstRelevantIndex === -1) {
    diagnostics.push(
      'No expected evidence appeared in the top 5 retrieval results.',
    );
  }
  if (evaluationCase.expectedBehavior === 'ABSTAIN' && !abstained) {
    diagnostics.push('The pipeline did not fully abstain as expected.');
  }
  if (evaluationCase.expectedBehavior !== 'ABSTAIN' && abstained) {
    diagnostics.push(
      'The pipeline fully abstained although an answer was expected.',
    );
  }
  if (
    evaluationCase.expectedBehavior === 'FULL_ANSWER' &&
    containsInsufficiencyStatement
  ) {
    diagnostics.push(
      'The answer includes an insufficiency statement although full coverage was expected.',
    );
  }
  if (answerEmpty) {
    diagnostics.push('The generated answer is empty.');
  }
  if (requiredAnswerTermGroupsPresent.includes(false)) {
    diagnostics.push('One or more required answer term groups are absent.');
  }
  if (
    evaluationCase.expectedBehavior === 'PARTIAL_ANSWER' &&
    requiredLimitationTermGroupsPresent.includes(false)
  ) {
    diagnostics.push(
      'The answer does not explicitly identify every unsupported part.',
    );
  }
  if (forbiddenTermsPresent.length > 0) {
    diagnostics.push(
      `Forbidden terms found: ${forbiddenTermsPresent.join(', ')}.`,
    );
  }
  if (
    evaluationCase.expectedBehavior !== 'ABSTAIN' &&
    !abstained &&
    expectedSourcePresent !== true
  ) {
    diagnostics.push('The expected source is absent from the answer sources.');
  }
  if (
    evaluationCase.expectedBehavior === 'ABSTAIN' &&
    sourceChunkIds.length > 0
  ) {
    diagnostics.push('A complete abstention must not return sources.');
  }

  const classification = classifyResult({
    evaluationCase,
    firstRelevantRank:
      firstRelevantIndex === -1 ? null : firstRelevantIndex + 1,
    abstained,
    forbiddenTermsPresent,
    expectedSourcePresent,
    sourcesPresent: sourceChunkIds.length > 0,
    expectedBehaviorSatisfied,
  });

  return {
    id: evaluationCase.id,
    question: evaluationCase.question,
    ...(evaluationCase.productKey === undefined
      ? {}
      : { productKey: evaluationCase.productKey }),
    expectedBehavior: evaluationCase.expectedBehavior,
    expectedEvidenceKeys: evaluationCase.expectedEvidenceKeys,
    retrieved: observation.retrieved.map((chunk) => ({
      id: chunk.id,
      documentId: chunk.documentId,
      documentName: chunk.documentName,
      productId: chunk.productId,
      chunkIndex: chunk.chunkIndex,
      similarity: chunk.similarity,
      evidenceKey: corpus.evidenceKeysByChunkId.get(chunk.id) ?? null,
    })),
    firstRelevantRank:
      firstRelevantIndex === -1 ? null : firstRelevantIndex + 1,
    retrievedCount: observation.retrieved.length,
    retrievalDurationMs: observation.retrievalDurationMs,
    generationDurationMs: observation.generationDurationMs,
    totalDurationMs: observation.totalDurationMs,
    answer: observation.answer.answer,
    observedModel: observation.observedModel,
    sourceChunkIds,
    checks: {
      abstained,
      containsInsufficiencyStatement,
      requiredAnswerTermGroupsPresent,
      requiredLimitationTermGroupsPresent,
      forbiddenTermsPresent,
      sourcesPresent: sourceChunkIds.length > 0,
      expectedSourcePresent,
      expectedBehaviorSatisfied,
    },
    classification,
    diagnostics,
  };
}

interface ClassificationInput {
  evaluationCase: RagEvaluationCase;
  firstRelevantRank: number | null;
  abstained: boolean;
  forbiddenTermsPresent: string[];
  expectedSourcePresent: boolean | null;
  sourcesPresent: boolean;
  expectedBehaviorSatisfied: boolean;
}

export function classifyResult(
  input: ClassificationInput,
): RagEvaluationClassification {
  if (
    input.evaluationCase.expectedEvidenceKeys.length > 0 &&
    input.firstRelevantRank === null
  ) {
    return 'retrieval failure';
  }
  if (
    (input.evaluationCase.expectedBehavior === 'ABSTAIN' &&
      (!input.abstained || input.sourcesPresent)) ||
    input.forbiddenTermsPresent.length > 0 ||
    (input.evaluationCase.expectedBehavior !== 'ABSTAIN' &&
      !input.abstained &&
      input.expectedSourcePresent !== true)
  ) {
    return 'abstention/grounding failure';
  }
  if (!input.expectedBehaviorSatisfied) {
    return 'generation failure';
  }
  return 'passed';
}

interface BehaviorInput {
  evaluationCase: RagEvaluationCase;
  answerEmpty: boolean;
  abstained: boolean;
  containsInsufficiencyStatement: boolean;
  requiredAnswerTermGroupsPresent: boolean[];
  requiredLimitationTermGroupsPresent: boolean[];
}

function behaviorIsSatisfied(input: BehaviorInput): boolean {
  switch (input.evaluationCase.expectedBehavior) {
    case 'FULL_ANSWER':
      return (
        !input.answerEmpty &&
        !input.containsInsufficiencyStatement &&
        input.requiredAnswerTermGroupsPresent.every(Boolean)
      );
    case 'PARTIAL_ANSWER':
      return (
        !input.answerEmpty &&
        !input.abstained &&
        input.requiredAnswerTermGroupsPresent.every(Boolean) &&
        input.requiredLimitationTermGroupsPresent.every(Boolean)
      );
    case 'ABSTAIN':
      return input.abstained;
  }
}

function groupsPresent(
  groups: string[][],
  normalizedAnswer: string,
): boolean[] {
  return groups.map((group) =>
    group.some((term) => normalizedAnswer.includes(normalizeText(term))),
  );
}
