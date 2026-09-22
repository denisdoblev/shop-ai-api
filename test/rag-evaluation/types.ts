import type { RetrievedChunk } from '../../src/ai/rag/retrieval/retrieval.service';

export type RagEvaluationExpectedBehavior =
  | 'FULL_ANSWER'
  | 'PARTIAL_ANSWER'
  | 'ABSTAIN';

export interface RagEvaluationProduct {
  key: string;
  name: string;
  slug: string;
  documents: RagEvaluationDocument[];
}

export interface RagEvaluationDocument {
  key: string;
  name: string;
  chunks: RagEvaluationChunk[];
}

export interface RagEvaluationChunk {
  evidenceKey: string;
  content: string;
  page: number;
  section: string;
}

export interface RagEvaluationCase {
  id: string;
  question: string;
  productKey?: string;
  expectedEvidenceKeys: string[];
  expectedBehavior: RagEvaluationExpectedBehavior;
  requiredAnswerTermGroups: string[][];
  requiredLimitationTermGroups?: string[][];
  forbiddenTerms: string[];
}

export interface RagEvaluationDataset {
  version: string;
  products: RagEvaluationProduct[];
  cases: RagEvaluationCase[];
}

export interface SeededRagEvaluationCorpus {
  productIdsByKey: Map<string, string>;
  chunkIdsByEvidenceKey: Map<string, string>;
  evidenceKeysByChunkId: Map<string, string>;
  observedEmbeddingModels: string[];
}

export type RagEvaluationClassification =
  | 'passed'
  | 'retrieval failure'
  | 'abstention/grounding failure'
  | 'generation failure';

export interface GenerationChecks {
  abstained: boolean;
  containsInsufficiencyStatement: boolean;
  requiredAnswerTermGroupsPresent: boolean[];
  requiredLimitationTermGroupsPresent: boolean[];
  forbiddenTermsPresent: string[];
  sourcesPresent: boolean;
  expectedSourcePresent: boolean | null;
  expectedBehaviorSatisfied: boolean;
}

export interface RagEvaluationCaseResult {
  id: string;
  question: string;
  productKey?: string;
  expectedBehavior: RagEvaluationExpectedBehavior;
  expectedEvidenceKeys: string[];
  retrieved: Array<
    Pick<
      RetrievedChunk,
      | 'id'
      | 'documentId'
      | 'documentName'
      | 'productId'
      | 'chunkIndex'
      | 'similarity'
    > & { evidenceKey: string | null }
  >;
  firstRelevantRank: number | null;
  retrievedCount: number;
  retrievalDurationMs: number;
  generationDurationMs: number | null;
  totalDurationMs: number;
  answer: string;
  observedModel: string | null;
  sourceChunkIds: string[];
  checks: GenerationChecks;
  classification: RagEvaluationClassification;
  diagnostics: string[];
}

export interface RagEvaluationMetrics {
  retrieval: {
    evaluatedCases: number;
    hitAt1: number;
    hitAt3: number;
    hitAt5: number;
    meanFirstRelevantRank: number | null;
  };
  generation: {
    evaluatedCases: number;
    expectedFullAnswers: number;
    expectedPartialAnswers: number;
    expectedAbstentions: number;
    correctFullAnswers: number;
    correctPartialAnswers: number;
    correctAbstentions: number;
    falseAbstentions: number;
    falseAnswers: number;
    correctBehavior: number;
    expectedAnswerTermsSatisfied: number;
    expectedLimitationsSatisfied: number;
    forbiddenTermViolations: number;
    expectedSourcePresent: number;
  };
  classifications: Record<RagEvaluationClassification, number>;
}

export interface RagEvaluationReport {
  schemaVersion: 3;
  dataset: { version: string; sha256: string; caseCount: number };
  startedAt: string;
  finishedAt: string;
  configuration: {
    topK: 5;
    strongSimilarityThreshold: number;
    moderateSimilarityThreshold: number;
    minimumSimilarityGap: number;
    configuredEmbeddingModel: string;
    configuredLlmModel: string;
    observedEmbeddingModels: string[];
    observedLlmModels: string[];
  };
  infrastructureFailure: string | null;
  metrics: RagEvaluationMetrics | null;
  results: RagEvaluationCaseResult[];
}
