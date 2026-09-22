export interface RelevanceThresholds {
  strongSimilarityThreshold: number;
  moderateSimilarityThreshold: number;
  minimumSimilarityGap: number;
}

export type RelevanceDecisionReason =
  | 'strong_similarity'
  | 'moderate_similarity_with_gap'
  | 'insufficient_relevance';

export interface RelevanceDecision {
  shouldGenerate: boolean;
  reason: RelevanceDecisionReason;
  top1Similarity: number | null;
  top2Similarity: number | null;
  similarityGap: number | null;
}

interface SimilarityResult {
  similarity: number;
}

export function evaluateRelevance(
  results: readonly SimilarityResult[],
  thresholds: RelevanceThresholds,
): RelevanceDecision {
  const top1Similarity = results[0]?.similarity ?? null;
  const top2Similarity = results[1]?.similarity ?? null;
  const similarityGap =
    top1Similarity === null || top2Similarity === null
      ? null
      : top1Similarity - top2Similarity;

  if (
    top1Similarity !== null &&
    top1Similarity >= thresholds.strongSimilarityThreshold
  ) {
    return {
      shouldGenerate: true,
      reason: 'strong_similarity',
      top1Similarity,
      top2Similarity,
      similarityGap,
    };
  }

  if (
    top1Similarity !== null &&
    top2Similarity !== null &&
    top1Similarity >= thresholds.moderateSimilarityThreshold &&
    similarityGap !== null &&
    similarityGap >= thresholds.minimumSimilarityGap
  ) {
    return {
      shouldGenerate: true,
      reason: 'moderate_similarity_with_gap',
      top1Similarity,
      top2Similarity,
      similarityGap,
    };
  }

  return {
    shouldGenerate: false,
    reason: 'insufficient_relevance',
    top1Similarity,
    top2Similarity,
    similarityGap,
  };
}
