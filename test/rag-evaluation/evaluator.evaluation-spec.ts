import { INSUFFICIENT_INFORMATION_ANSWER } from '../../src/ai/rag/grounding-prompt';
import { RAG_EVALUATION_DATASET } from './dataset';
import { validateDataset } from './dataset-validation';
import { classifyResult, evaluateCase, normalizeText } from './evaluator';
import { calculateMetrics } from './metrics';
import { hashDataset } from './reporter';
import type { RagEvaluationCaseResult, RagEvaluationReport } from './types';

describe('RAG evaluation utilities', () => {
  it('validates the 24-case dataset and its intended composition', () => {
    expect(() => validateDataset(RAG_EVALUATION_DATASET)).not.toThrow();
    expect(RAG_EVALUATION_DATASET.version).toBe('1.3.0');
    expect(RAG_EVALUATION_DATASET.cases).toHaveLength(24);
    expect(countCases('FULL_ANSWER')).toBe(15);
    expect(countCases('PARTIAL_ANSWER')).toBe(3);
    expect(countCases('ABSTAIN')).toBe(6);
  });

  it('rejects duplicate stable identifiers before infrastructure access', () => {
    const invalidDataset = structuredClone(RAG_EVALUATION_DATASET);
    invalidDataset.cases[1].id = invalidDataset.cases[0].id;

    expect(() => validateDataset(invalidDataset)).toThrow('duplicate case id');
  });

  it('normalizes case, diacritics, and whitespace for term checks', () => {
    expect(normalizeText('  BotÓN\n  FÍSICO  ')).toBe('boton fisico');
  });

  it('checks required groups, forbidden terms, abstention, and expected sources', () => {
    const result = evaluateCase(
      {
        id: 'checks',
        question: '¿Tiene un botón?',
        expectedEvidenceKeys: ['mute'],
        expectedBehavior: 'FULL_ANSWER',
        requiredAnswerTermGroups: [['boton', 'control']],
        forbiddenTerms: ['inventado'],
      },
      {
        answer: {
          answer: 'Sí, tiene un BOTÓN físico inventado.',
          sources: [
            {
              chunkId: 'chunk-1',
              documentId: 'document-1',
              documentName: 'Manual',
              productId: 'product-1',
              chunkIndex: 0,
              pageStart: 1,
              pageEnd: 1,
              section: 'Controles',
            },
          ],
        },
        retrievalMode: 'vector',
        effectiveCandidates: [
          {
            id: 'chunk-1',
            documentId: 'document-1',
            documentName: 'Manual',
            productId: 'product-1',
            content: 'Tiene un botón físico.',
            chunkIndex: 0,
            pageStart: 1,
            pageEnd: 1,
            section: 'Controles',
            metadata: { evidenceKey: 'mute' },
            similarity: 0.9,
          },
        ],
        retrievalDurationMs: 1,
        generationDurationMs: 2,
        totalDurationMs: 3,
        observedModel: 'qwen3:8b',
      },
      {
        productIdsByKey: new Map(),
        chunkIdsByEvidenceKey: new Map([['mute', 'chunk-1']]),
        evidenceKeysByChunkId: new Map([['chunk-1', 'mute']]),
        observedEmbeddingModels: ['embeddinggemma'],
      },
    );

    expect(result.checks).toEqual({
      abstained: false,
      containsInsufficiencyStatement: false,
      requiredAnswerTermGroupsPresent: [true],
      requiredLimitationTermGroupsPresent: [],
      forbiddenTermsPresent: ['inventado'],
      sourcesPresent: true,
      expectedSourcePresent: true,
      expectedBehaviorSatisfied: true,
    });
    expect(result).toMatchObject({
      retrievalMode: 'vector',
      effectiveCandidates: [
        {
          id: 'chunk-1',
          evidenceKey: 'mute',
          score: { type: 'similarity', value: 0.9 },
        },
      ],
    });
    expect(result.classification).toBe('abstention/grounding failure');
  });

  it('records a lexical candidate with its typed score', () => {
    const evaluationCase = RAG_EVALUATION_DATASET.cases.find(
      ({ id }) => id === 'lexical-01',
    );
    if (evaluationCase === undefined) throw new Error('Missing lexical-01');

    const result = evaluateCase(
      evaluationCase,
      {
        answer: {
          answer: 'Sí, usa Bluetooth 5.3.',
          sources: [
            {
              chunkId: 'airpods-chunk',
              documentId: 'airpods-document',
              documentName: 'Especificaciones',
              productId: 'airpods-product',
              chunkIndex: 0,
              pageStart: 1,
              pageEnd: 1,
              section: 'Conectividad',
            },
          ],
        },
        retrievalMode: 'lexical',
        effectiveCandidates: [
          {
            id: 'airpods-chunk',
            documentId: 'airpods-document',
            documentName: 'Especificaciones',
            productId: 'airpods-product',
            content: 'Tecnología inalámbrica Bluetooth 5.3.',
            chunkIndex: 0,
            pageStart: 1,
            pageEnd: 1,
            section: 'Conectividad',
            metadata: {},
            lexicalScore: 0.4,
          },
        ],
        retrievalDurationMs: 1,
        generationDurationMs: 2,
        totalDurationMs: 3,
        observedModel: 'qwen3:8b',
      },
      {
        productIdsByKey: new Map(),
        chunkIdsByEvidenceKey: new Map([
          ['airpods-conectividad', 'airpods-chunk'],
        ]),
        evidenceKeysByChunkId: new Map([
          ['airpods-chunk', 'airpods-conectividad'],
        ]),
        observedEmbeddingModels: ['embeddinggemma'],
      },
    );

    expect(result).toMatchObject({
      retrievalMode: 'lexical',
      effectiveCandidates: [
        {
          evidenceKey: 'airpods-conectividad',
          score: { type: 'lexicalScore', value: 0.4 },
        },
      ],
      firstRelevantRank: 1,
    });
  });

  it('distinguishes a grounded partial answer from a complete abstention', () => {
    const partialAnswer = evaluatePartialBatteryCase(
      `La batería dura hasta 38 horas. ${INSUFFICIENT_INFORMATION_ANSWER} sobre el peso.`,
      true,
    );
    const completeAbstention = evaluatePartialBatteryCase(
      INSUFFICIENT_INFORMATION_ANSWER,
      false,
    );

    expect(partialAnswer.checks).toMatchObject({
      abstained: false,
      containsInsufficiencyStatement: true,
      requiredAnswerTermGroupsPresent: [true],
      requiredLimitationTermGroupsPresent: [true, true],
      expectedSourcePresent: true,
      expectedBehaviorSatisfied: true,
    });
    expect(partialAnswer.classification).toBe('passed');
    expect(completeAbstention.checks.expectedBehaviorSatisfied).toBe(false);
    expect(completeAbstention.classification).toBe('generation failure');
  });

  it.each([
    ['retrieval failure', null, 'FULL_ANSWER', false, true, [], true],
    ['abstention/grounding failure', 1, 'ABSTAIN', false, false, [], null],
    ['generation failure', 1, 'FULL_ANSWER', true, false, [], true],
    ['passed', 1, 'FULL_ANSWER', false, true, [], true],
  ] as const)(
    'classifies %s with the documented precedence',
    (
      expected,
      firstRelevantRank,
      expectedBehavior,
      abstained,
      expectedBehaviorSatisfied,
      forbiddenTermsPresent,
      expectedSourcePresent,
    ) => {
      expect(
        classifyResult({
          evaluationCase: {
            id: 'synthetic',
            question: 'Pregunta',
            expectedEvidenceKeys: ['evidence'],
            expectedBehavior,
            requiredAnswerTermGroups: [],
            forbiddenTerms: [],
          },
          firstRelevantRank,
          abstained,
          forbiddenTermsPresent: [...forbiddenTermsPresent],
          expectedSourcePresent,
          sourcesPresent: false,
          expectedBehaviorSatisfied,
        }),
      ).toBe(expected);
    },
  );

  it('calculates Hit@K without unsupported cases in the denominator', () => {
    const results = [
      syntheticResult('one', 1, ['evidence']),
      syntheticResult('two', 3, ['evidence']),
      syntheticResult('three', null, ['evidence']),
      syntheticResult('unsupported', null, []),
    ];

    expect(calculateMetrics(results).retrieval).toEqual({
      evaluatedCases: 3,
      hitAt1: 1 / 3,
      hitAt3: 2 / 3,
      hitAt5: 2 / 3,
      meanFirstRelevantRank: 2,
    });
  });

  it('serializes a synthetic report and hashes the dataset deterministically', () => {
    const result = syntheticResult('serializable', 1, ['evidence']);
    const datasetCaseCount = RAG_EVALUATION_DATASET.cases.length;
    const report: RagEvaluationReport = {
      schemaVersion: 4,
      dataset: {
        version: RAG_EVALUATION_DATASET.version,
        sha256: hashDataset(RAG_EVALUATION_DATASET),
        caseCount: datasetCaseCount,
      },
      startedAt: '2026-01-01T00:00:00.000Z',
      finishedAt: '2026-01-01T00:00:01.000Z',
      configuration: {
        topK: 5,
        strongSimilarityThreshold: 0.5,
        moderateSimilarityThreshold: 0.4,
        minimumSimilarityGap: 0.12,
        configuredEmbeddingModel: 'embeddinggemma',
        configuredLlmModel: 'qwen3:8b',
        observedEmbeddingModels: ['embeddinggemma'],
        observedLlmModels: ['qwen3:8b'],
      },
      infrastructureFailure: null,
      metrics: calculateMetrics([result]),
      results: [result],
    };

    const serialized = JSON.stringify(report);
    expect(JSON.parse(serialized)).toMatchObject({
      schemaVersion: 4,
      dataset: { caseCount: datasetCaseCount },
      results: [{ id: 'serializable' }],
    });
    expect(report.dataset.caseCount).toBe(RAG_EVALUATION_DATASET.cases.length);
    expect(hashDataset(RAG_EVALUATION_DATASET)).toHaveLength(64);
    expect(hashDataset(RAG_EVALUATION_DATASET)).toBe(
      hashDataset(RAG_EVALUATION_DATASET),
    );
  });
});

function countCases(
  expectedBehavior: 'FULL_ANSWER' | 'PARTIAL_ANSWER' | 'ABSTAIN',
): number {
  return RAG_EVALUATION_DATASET.cases.filter(
    (entry) => entry.expectedBehavior === expectedBehavior,
  ).length;
}

function syntheticResult(
  id: string,
  firstRelevantRank: number | null,
  expectedEvidenceKeys: string[],
): RagEvaluationCaseResult {
  return {
    id,
    question: 'Pregunta sintética',
    expectedBehavior:
      expectedEvidenceKeys.length > 0 ? 'FULL_ANSWER' : 'ABSTAIN',
    expectedEvidenceKeys,
    retrievalMode: 'vector',
    effectiveCandidates: [],
    firstRelevantRank,
    retrievedCount: 0,
    retrievalDurationMs: 10,
    generationDurationMs: 20,
    totalDurationMs: 30,
    answer:
      expectedEvidenceKeys.length > 0
        ? 'Respuesta'
        : INSUFFICIENT_INFORMATION_ANSWER,
    observedModel: 'qwen3:8b',
    sourceChunkIds: expectedEvidenceKeys.length > 0 ? ['chunk'] : [],
    checks: {
      abstained: expectedEvidenceKeys.length === 0,
      containsInsufficiencyStatement: expectedEvidenceKeys.length === 0,
      requiredAnswerTermGroupsPresent: [],
      requiredLimitationTermGroupsPresent: [],
      forbiddenTermsPresent: [],
      sourcesPresent: expectedEvidenceKeys.length > 0,
      expectedSourcePresent: expectedEvidenceKeys.length > 0 ? true : null,
      expectedBehaviorSatisfied: true,
    },
    classification: 'passed',
    diagnostics: [],
  };
}

function evaluatePartialBatteryCase(answer: string, includeSource: boolean) {
  const evaluationCase = RAG_EVALUATION_DATASET.cases.find(
    ({ id }) => id === 'partial-01',
  );
  if (evaluationCase === undefined) throw new Error('Missing partial-01 case');

  return evaluateCase(
    evaluationCase,
    {
      answer: {
        answer,
        sources: includeSource
          ? [
              {
                chunkId: 'chunk-battery',
                documentId: 'document-1',
                documentName: 'Manual',
                productId: 'product-1',
                chunkIndex: 0,
                pageStart: 1,
                pageEnd: 1,
                section: 'Batería',
              },
            ]
          : [],
      },
      retrievalMode: 'vector',
      effectiveCandidates: [
        {
          id: 'chunk-battery',
          documentId: 'document-1',
          documentName: 'Manual',
          productId: 'product-1',
          content: 'La batería ofrece hasta 38 horas de autonomía.',
          chunkIndex: 0,
          pageStart: 1,
          pageEnd: 1,
          section: 'Batería',
          metadata: { evidenceKey: 'auricular-bateria' },
          similarity: 0.5,
        },
      ],
      retrievalDurationMs: 1,
      generationDurationMs: includeSource ? 2 : null,
      totalDurationMs: 3,
      observedModel: includeSource ? 'qwen3:8b' : null,
    },
    {
      productIdsByKey: new Map(),
      chunkIdsByEvidenceKey: new Map([['auricular-bateria', 'chunk-battery']]),
      evidenceKeysByChunkId: new Map([['chunk-battery', 'auricular-bateria']]),
      observedEmbeddingModels: ['embeddinggemma'],
    },
  );
}
