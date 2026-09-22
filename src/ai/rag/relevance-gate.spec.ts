import { evaluateRelevance, RelevanceThresholds } from './relevance-gate';

const thresholds: RelevanceThresholds = {
  strongSimilarityThreshold: 0.5,
  moderateSimilarityThreshold: 0.4,
  minimumSimilarityGap: 0.12,
};

describe('evaluateRelevance', () => {
  it('accepts a strong absolute match regardless of a weak gap', () => {
    expect(evaluateRelevance(similarities(0.62, 0.6), thresholds)).toEqual({
      shouldGenerate: true,
      reason: 'strong_similarity',
      top1Similarity: 0.62,
      top2Similarity: 0.6,
      similarityGap: 0.020000000000000018,
    });
  });

  it('accepts a moderate match with a strong gap', () => {
    expect(evaluateRelevance(similarities(0.45, 0.2), thresholds)).toEqual({
      shouldGenerate: true,
      reason: 'moderate_similarity_with_gap',
      top1Similarity: 0.45,
      top2Similarity: 0.2,
      similarityGap: 0.25,
    });
  });

  it('rejects a moderate match with a weak gap', () => {
    expect(evaluateRelevance(similarities(0.43, 0.4), thresholds)).toEqual({
      shouldGenerate: false,
      reason: 'insufficient_relevance',
      top1Similarity: 0.43,
      top2Similarity: 0.4,
      similarityGap: 0.02999999999999997,
    });
  });

  it('rejects scores below the moderate threshold', () => {
    expect(evaluateRelevance(similarities(0.25, 0.2), thresholds)).toEqual({
      shouldGenerate: false,
      reason: 'insufficient_relevance',
      top1Similarity: 0.25,
      top2Similarity: 0.2,
      similarityGap: 0.04999999999999999,
    });
  });

  it('rejects empty results', () => {
    expect(evaluateRelevance([], thresholds)).toEqual({
      shouldGenerate: false,
      reason: 'insufficient_relevance',
      top1Similarity: null,
      top2Similarity: null,
      similarityGap: null,
    });
  });

  it('accepts a single strong result', () => {
    expect(evaluateRelevance(similarities(0.5), thresholds)).toMatchObject({
      shouldGenerate: true,
      reason: 'strong_similarity',
      top2Similarity: null,
      similarityGap: null,
    });
  });

  it('rejects a single moderate result because dominance is unobservable', () => {
    expect(evaluateRelevance(similarities(0.49), thresholds)).toMatchObject({
      shouldGenerate: false,
      reason: 'insufficient_relevance',
      top2Similarity: null,
      similarityGap: null,
    });
  });

  it('treats exact thresholds as inclusive', () => {
    expect(evaluateRelevance(similarities(0.5), thresholds).reason).toBe(
      'strong_similarity',
    );
    expect(evaluateRelevance(similarities(0.4, 0.28), thresholds).reason).toBe(
      'moderate_similarity_with_gap',
    );
  });

  it('rejects values immediately below either moderate threshold', () => {
    expect(
      evaluateRelevance(similarities(0.4 - Number.EPSILON, 0.2), thresholds)
        .reason,
    ).toBe('insufficient_relevance');
    expect(
      evaluateRelevance(similarities(0.4, 0.2800000001), thresholds).reason,
    ).toBe('insufficient_relevance');
  });
});

function similarities(...values: number[]): Array<{ similarity: number }> {
  return values.map((similarity) => ({ similarity }));
}
