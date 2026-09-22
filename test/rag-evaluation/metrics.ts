import type {
  RagEvaluationClassification,
  RagEvaluationMetrics,
  RagEvaluationCaseResult,
} from './types';

export function calculateMetrics(
  results: RagEvaluationCaseResult[],
): RagEvaluationMetrics {
  const retrievalResults = results.filter(
    ({ expectedEvidenceKeys }) => expectedEvidenceKeys.length > 0,
  );
  const relevantRanks = retrievalResults
    .map(({ firstRelevantRank }) => firstRelevantRank)
    .filter((rank): rank is number => rank !== null);
  const fullAnswerResults = results.filter(
    ({ expectedBehavior }) => expectedBehavior === 'FULL_ANSWER',
  );
  const partialAnswerResults = results.filter(
    ({ expectedBehavior }) => expectedBehavior === 'PARTIAL_ANSWER',
  );
  const abstentionResults = results.filter(
    ({ expectedBehavior }) => expectedBehavior === 'ABSTAIN',
  );
  const answerResults = [...fullAnswerResults, ...partialAnswerResults];
  const classifications: Record<RagEvaluationClassification, number> = {
    passed: 0,
    'retrieval failure': 0,
    'abstention/grounding failure': 0,
    'generation failure': 0,
  };
  for (const result of results) classifications[result.classification] += 1;

  return {
    retrieval: {
      evaluatedCases: retrievalResults.length,
      hitAt1: ratio(
        retrievalResults.filter(
          ({ firstRelevantRank }) => firstRelevantRank === 1,
        ).length,
        retrievalResults.length,
      ),
      hitAt3: ratio(
        retrievalResults.filter(
          ({ firstRelevantRank }) =>
            firstRelevantRank !== null && firstRelevantRank <= 3,
        ).length,
        retrievalResults.length,
      ),
      hitAt5: ratio(relevantRanks.length, retrievalResults.length),
      meanFirstRelevantRank:
        relevantRanks.length === 0
          ? null
          : relevantRanks.reduce((sum, rank) => sum + rank, 0) /
            relevantRanks.length,
    },
    generation: {
      evaluatedCases: results.length,
      expectedFullAnswers: fullAnswerResults.length,
      expectedPartialAnswers: partialAnswerResults.length,
      expectedAbstentions: abstentionResults.length,
      correctFullAnswers: fullAnswerResults.filter(
        ({ checks }) => checks.expectedBehaviorSatisfied,
      ).length,
      correctPartialAnswers: partialAnswerResults.filter(
        ({ checks }) => checks.expectedBehaviorSatisfied,
      ).length,
      correctAbstentions: abstentionResults.filter(
        ({ checks }) => checks.expectedBehaviorSatisfied,
      ).length,
      falseAbstentions: answerResults.filter(({ checks }) => checks.abstained)
        .length,
      falseAnswers: abstentionResults.filter(({ checks }) => !checks.abstained)
        .length,
      correctBehavior: results.filter(
        ({ checks }) => checks.expectedBehaviorSatisfied,
      ).length,
      expectedAnswerTermsSatisfied: answerResults.filter(({ checks }) =>
        checks.requiredAnswerTermGroupsPresent.every(Boolean),
      ).length,
      expectedLimitationsSatisfied: partialAnswerResults.filter(({ checks }) =>
        checks.requiredLimitationTermGroupsPresent.every(Boolean),
      ).length,
      forbiddenTermViolations: results.filter(
        ({ checks }) => checks.forbiddenTermsPresent.length > 0,
      ).length,
      expectedSourcePresent: answerResults.filter(
        ({ checks }) => checks.expectedSourcePresent === true,
      ).length,
    },
    classifications,
  };
}

function ratio(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}
