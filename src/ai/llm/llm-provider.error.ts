export type LlmProviderErrorCode =
  | 'invalid_input'
  | 'timeout'
  | 'unavailable'
  | 'upstream_error'
  | 'invalid_response';

export class LlmProviderError extends Error {
  constructor(
    public readonly code: LlmProviderErrorCode,
    message: string,
  ) {
    super(message);
    this.name = LlmProviderError.name;
  }
}
