export type EmbeddingProviderErrorCode =
  | 'invalid_input'
  | 'timeout'
  | 'unavailable'
  | 'upstream_error'
  | 'invalid_response';

export class EmbeddingProviderError extends Error {
  constructor(
    public readonly code: EmbeddingProviderErrorCode,
    message: string,
  ) {
    super(message);
    this.name = EmbeddingProviderError.name;
  }
}
