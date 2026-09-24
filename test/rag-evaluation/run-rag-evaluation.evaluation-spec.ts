import { INestApplication } from '@nestjs/common';
import type {
  GenerateInput,
  GenerateOutput,
} from '../../src/ai/llm/llm-provider.interface';
import { LlmService } from '../../src/ai/llm/llm.service';
import { RagService } from '../../src/ai/rag/rag.service';
import type { RagAnswer } from '../../src/ai/rag/rag.service';
import { RetrievalService } from '../../src/ai/rag/retrieval/retrieval.service';
import type {
  LexicalRetrievedChunk,
  LexicalRetrievalOptions,
  RetrievedChunk,
  RetrievalOptions,
} from '../../src/ai/rag/retrieval/retrieval.service';
import { clearDatabase, closeTestApp, initTestApp } from '../test-utils';
import { RAG_EVALUATION_DATASET } from './dataset';
import { validateDataset } from './dataset-validation';
import { evaluateCase } from './evaluator';
import { calculateMetrics } from './metrics';
import { hashDataset, printSummary, writeReport } from './reporter';
import { seedRagEvaluationCorpus } from './seeder';
import type {
  RagEvaluationCaseResult,
  RagEvaluationReport,
  RagEvaluationRetrievalMode,
} from './types';

describe('RAG evaluation baseline', () => {
  jest.setTimeout(20 * 60_000);

  let app: INestApplication | undefined;

  afterAll(async () => {
    if (app !== undefined) await closeTestApp(app);
  });

  it('evaluates the versioned dataset and writes a diagnostic report', async () => {
    validateDataset(RAG_EVALUATION_DATASET);
    const startedAt = new Date();
    const results: RagEvaluationCaseResult[] = [];
    let observedEmbeddingModels: string[] = [];
    const baseReport = {
      schemaVersion: 4 as const,
      dataset: {
        version: RAG_EVALUATION_DATASET.version,
        sha256: hashDataset(RAG_EVALUATION_DATASET),
        caseCount: RAG_EVALUATION_DATASET.cases.length,
      },
      startedAt: startedAt.toISOString(),
      configuration: {
        topK: 5 as const,
        strongSimilarityThreshold: Number(
          process.env.RAG_STRONG_SIMILARITY_THRESHOLD ?? 0.5,
        ),
        moderateSimilarityThreshold: Number(
          process.env.RAG_MODERATE_SIMILARITY_THRESHOLD ?? 0.4,
        ),
        minimumSimilarityGap: Number(
          process.env.RAG_MINIMUM_SIMILARITY_GAP ?? 0.12,
        ),
        configuredEmbeddingModel:
          process.env.OLLAMA_EMBEDDING_MODEL ?? 'embeddinggemma',
        configuredLlmModel: process.env.OLLAMA_LLM_MODEL ?? 'qwen3:8b',
      },
    };

    try {
      app = await initTestApp();
      await clearDatabase();
      const corpus = await seedRagEvaluationCorpus(app, RAG_EVALUATION_DATASET);
      observedEmbeddingModels = corpus.observedEmbeddingModels;
      const ragService = app.get(RagService);
      const retrievalService = app.get(RetrievalService);
      const llmService = app.get(LlmService);
      const originalFindBestLexicalMatch =
        retrievalService.findBestLexicalMatch.bind(retrievalService);
      const originalRetrieve = retrievalService.retrieve.bind(retrievalService);
      const originalGenerate = llmService.generate.bind(llmService);
      let retrievalMode: RagEvaluationRetrievalMode = 'vector';
      let effectiveCandidates: Array<RetrievedChunk | LexicalRetrievedChunk> =
        [];
      let retrievalDurationMs = 0;
      let generationDurationMs: number | null = null;
      let observedModel: string | null = null;

      jest
        .spyOn(retrievalService, 'findBestLexicalMatch')
        .mockImplementation(
          async (
            question: string,
            options?: LexicalRetrievalOptions,
          ): Promise<LexicalRetrievedChunk | null> => {
            const callStartedAt = performance.now();
            try {
              const match = await originalFindBestLexicalMatch(
                question,
                options,
              );
              if (match !== null) {
                retrievalMode = 'lexical';
                effectiveCandidates = [match];
              }
              return match;
            } finally {
              retrievalDurationMs += performance.now() - callStartedAt;
            }
          },
        );
      jest
        .spyOn(retrievalService, 'retrieve')
        .mockImplementation(
          async (
            query: string,
            options: RetrievalOptions,
          ): Promise<RetrievedChunk[]> => {
            const callStartedAt = performance.now();
            try {
              const retrieved = await originalRetrieve(query, options);
              retrievalMode = 'vector';
              effectiveCandidates = retrieved;
              return retrieved;
            } finally {
              retrievalDurationMs += performance.now() - callStartedAt;
            }
          },
        );
      jest
        .spyOn(llmService, 'generate')
        .mockImplementation(
          async (input: GenerateInput): Promise<GenerateOutput> => {
            const callStartedAt = performance.now();
            try {
              const output = await originalGenerate(input);
              observedModel = output.model;
              return output;
            } finally {
              generationDurationMs = performance.now() - callStartedAt;
            }
          },
        );

      for (const evaluationCase of RAG_EVALUATION_DATASET.cases) {
        retrievalMode = 'vector';
        effectiveCandidates = [];
        retrievalDurationMs = 0;
        generationDurationMs = null;
        observedModel = null;
        const productId =
          evaluationCase.productKey === undefined
            ? undefined
            : corpus.productIdsByKey.get(evaluationCase.productKey);
        if (
          evaluationCase.productKey !== undefined &&
          productId === undefined
        ) {
          throw new Error(
            `Product was not seeded: ${evaluationCase.productKey}`,
          );
        }

        const callStartedAt = performance.now();
        const answer: RagAnswer = await ragService.answer({
          question: evaluationCase.question,
          topK: 5,
          ...(productId === undefined ? {} : { productId }),
        });
        results.push(
          evaluateCase(
            evaluationCase,
            {
              answer,
              retrievalMode,
              effectiveCandidates,
              retrievalDurationMs,
              generationDurationMs,
              totalDurationMs: performance.now() - callStartedAt,
              observedModel,
            },
            corpus,
          ),
        );
      }

      const report: RagEvaluationReport = {
        ...baseReport,
        finishedAt: new Date().toISOString(),
        configuration: {
          ...baseReport.configuration,
          observedEmbeddingModels,
          observedLlmModels: [
            ...new Set(
              results
                .map(({ observedModel: model }) => model)
                .filter((model): model is string => model !== null),
            ),
          ],
        },
        infrastructureFailure: null,
        metrics: calculateMetrics(results),
        results,
      };
      const reportPath = await writeReport(report);
      printSummary(report, reportPath);
    } catch (error: unknown) {
      const infrastructureFailure = errorMessage(error);
      const report: RagEvaluationReport = {
        ...baseReport,
        finishedAt: new Date().toISOString(),
        configuration: {
          ...baseReport.configuration,
          observedEmbeddingModels,
          observedLlmModels: [
            ...new Set(
              results
                .map(({ observedModel: model }) => model)
                .filter((model): model is string => model !== null),
            ),
          ],
        },
        infrastructureFailure,
        metrics: results.length === 0 ? null : calculateMetrics(results),
        results,
      };
      const reportPath = await writeReport(report);
      printSummary(report, reportPath);
      throw error;
    }
  });
});

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
