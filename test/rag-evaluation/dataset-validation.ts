import type { RagEvaluationDataset } from './types';

export function validateDataset(dataset: RagEvaluationDataset): void {
  const errors: string[] = [];
  const productKeys = new Set<string>();
  const documentKeys = new Set<string>();
  const evidenceKeys = new Set<string>();
  const caseIds = new Set<string>();

  if (dataset.version.trim().length === 0) errors.push('version is required');

  for (const product of dataset.products) {
    addUnique(productKeys, product.key, 'product key', errors);
    for (const document of product.documents) {
      addUnique(documentKeys, document.key, 'document key', errors);
      for (const chunk of document.chunks) {
        addUnique(evidenceKeys, chunk.evidenceKey, 'evidence key', errors);
        if (chunk.content.trim().length === 0) {
          errors.push(`evidence ${chunk.evidenceKey} has empty content`);
        }
      }
    }
  }

  for (const evaluationCase of dataset.cases) {
    addUnique(caseIds, evaluationCase.id, 'case id', errors);
    if (
      evaluationCase.productKey !== undefined &&
      !productKeys.has(evaluationCase.productKey)
    ) {
      errors.push(
        `case ${evaluationCase.id} references unknown product ${evaluationCase.productKey}`,
      );
    }
    for (const evidenceKey of evaluationCase.expectedEvidenceKeys) {
      if (!evidenceKeys.has(evidenceKey)) {
        errors.push(
          `case ${evaluationCase.id} references unknown evidence ${evidenceKey}`,
        );
      }
    }
    validateTermGroups(
      evaluationCase.requiredAnswerTermGroups,
      `case ${evaluationCase.id} required answer terms`,
      errors,
    );
    const requiredLimitationTermGroups =
      evaluationCase.requiredLimitationTermGroups ?? [];
    validateTermGroups(
      requiredLimitationTermGroups,
      `case ${evaluationCase.id} required limitation terms`,
      errors,
    );
    if (
      evaluationCase.expectedBehavior === 'FULL_ANSWER' &&
      (evaluationCase.expectedEvidenceKeys.length === 0 ||
        evaluationCase.requiredAnswerTermGroups.length === 0 ||
        requiredLimitationTermGroups.length > 0)
    ) {
      errors.push(
        `full-answer case ${evaluationCase.id} has incoherent expectations`,
      );
    }
    if (
      evaluationCase.expectedBehavior === 'PARTIAL_ANSWER' &&
      (evaluationCase.expectedEvidenceKeys.length === 0 ||
        evaluationCase.requiredAnswerTermGroups.length === 0 ||
        requiredLimitationTermGroups.length === 0)
    ) {
      errors.push(
        `partial-answer case ${evaluationCase.id} has incoherent expectations`,
      );
    }
    if (
      evaluationCase.expectedBehavior === 'ABSTAIN' &&
      (evaluationCase.expectedEvidenceKeys.length > 0 ||
        evaluationCase.requiredAnswerTermGroups.length > 0 ||
        requiredLimitationTermGroups.length > 0)
    ) {
      errors.push(
        `abstention case ${evaluationCase.id} must not expect evidence`,
      );
    }
  }

  if (errors.length > 0) {
    throw new Error(
      `Invalid RAG evaluation dataset:\n- ${errors.join('\n- ')}`,
    );
  }
}

function validateTermGroups(
  groups: string[][],
  label: string,
  errors: string[],
): void {
  groups.forEach((group, groupIndex) => {
    if (group.length === 0) {
      errors.push(`${label} group ${groupIndex + 1} must not be empty`);
    }
    group.forEach((term, termIndex) => {
      if (term.trim().length === 0) {
        errors.push(
          `${label} group ${groupIndex + 1} term ${termIndex + 1} must not be empty`,
        );
      }
    });
  });
}

function addUnique(
  values: Set<string>,
  value: string,
  label: string,
  errors: string[],
): void {
  if (value.trim().length === 0) errors.push(`${label} must not be empty`);
  if (values.has(value)) errors.push(`duplicate ${label}: ${value}`);
  values.add(value);
}
