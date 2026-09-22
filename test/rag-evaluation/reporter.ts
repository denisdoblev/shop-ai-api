import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { RagEvaluationDataset, RagEvaluationReport } from './types';

export function hashDataset(dataset: RagEvaluationDataset): string {
  return createHash('sha256').update(JSON.stringify(dataset)).digest('hex');
}

export async function writeReport(
  report: RagEvaluationReport,
): Promise<string> {
  const artifactsDirectory = join(process.cwd(), 'artifacts');
  const reportPath = join(artifactsDirectory, 'rag-evaluation.json');
  await mkdir(artifactsDirectory, { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return reportPath;
}

export function printSummary(
  report: RagEvaluationReport,
  reportPath: string,
): void {
  if (report.infrastructureFailure !== null) {
    console.error(
      `RAG evaluation infrastructure failure: ${report.infrastructureFailure}`,
    );
    console.error(`Report: ${reportPath}`);
    return;
  }

  const metrics = report.metrics;
  if (metrics === null) return;
  console.log('\nRAG evaluation summary');
  console.log(
    `Retrieval Hit@1/3/5: ${formatRatio(metrics.retrieval.hitAt1)} / ${formatRatio(metrics.retrieval.hitAt3)} / ${formatRatio(metrics.retrieval.hitAt5)}`,
  );
  console.log(
    `Relevance gate: top1 >= ${report.configuration.strongSimilarityThreshold} OR (top1 >= ${report.configuration.moderateSimilarityThreshold} AND gap >= ${report.configuration.minimumSimilarityGap})`,
  );
  console.log(
    `Generation behavior: ${metrics.generation.correctBehavior}/${metrics.generation.evaluatedCases} correct`,
  );
  console.log(
    `Full/partial/abstention correct: ${metrics.generation.correctFullAnswers}/${metrics.generation.expectedFullAnswers} / ${metrics.generation.correctPartialAnswers}/${metrics.generation.expectedPartialAnswers} / ${metrics.generation.correctAbstentions}/${metrics.generation.expectedAbstentions}`,
  );
  console.log(
    `False abstentions/answers: ${metrics.generation.falseAbstentions} / ${metrics.generation.falseAnswers}`,
  );
  console.log(
    `Classifications: ${Object.entries(metrics.classifications)
      .map(([classification, count]) => `${classification}=${count}`)
      .join(', ')}`,
  );

  for (const result of report.results.filter(
    ({ classification }) => classification !== 'passed',
  )) {
    console.log(`- ${result.id}: ${result.classification}`);
    for (const diagnostic of result.diagnostics) console.log(`  ${diagnostic}`);
  }
  console.log(`Report: ${reportPath}`);
}

function formatRatio(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}
