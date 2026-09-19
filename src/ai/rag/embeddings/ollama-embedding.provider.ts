import { EmbeddingProviderError } from './embedding-provider.error';
import {
  EmbeddingInput,
  EmbeddingProvider,
  EmbeddingVector,
} from './embedding-provider.interface';

export const OLLAMA_EMBEDDING_DIMENSIONS = 768;

export interface OllamaEmbeddingProviderOptions {
  baseUrl: string;
  model: string;
  timeoutMs: number;
}

interface OllamaEmbedResponse {
  embeddings: unknown[];
}

export class OllamaEmbeddingProvider implements EmbeddingProvider {
  constructor(private readonly options: OllamaEmbeddingProviderOptions) {}

  async embed(inputs: EmbeddingInput[]): Promise<EmbeddingVector[]> {
    if (inputs.length === 0) {
      return [];
    }

    const formattedInputs = inputs.map((input) => this.formatInput(input));
    const controller = new AbortController();
    const timeout = setTimeout(
      () => controller.abort(),
      this.options.timeoutMs,
    );

    try {
      const response = await fetch(
        new URL('/api/embed', this.options.baseUrl),
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            model: this.options.model,
            input: formattedInputs,
            dimensions: OLLAMA_EMBEDDING_DIMENSIONS,
            truncate: false,
          }),
          signal: controller.signal,
        },
      );

      if (!response.ok) {
        throw new EmbeddingProviderError(
          'upstream_error',
          `Embedding provider returned HTTP ${response.status}`,
        );
      }

      const payload = await this.parseResponse(response);
      if (payload.embeddings.length !== inputs.length) {
        throw new EmbeddingProviderError(
          'invalid_response',
          'Embedding provider returned an unexpected number of vectors',
        );
      }

      return payload.embeddings.map((value) => this.toEmbeddingVector(value));
    } catch (error: unknown) {
      if (error instanceof EmbeddingProviderError) {
        throw error;
      }
      if (controller.signal.aborted) {
        throw new EmbeddingProviderError(
          'timeout',
          'Embedding provider request timed out',
        );
      }
      throw new EmbeddingProviderError(
        'unavailable',
        'Embedding provider is unavailable',
      );
    } finally {
      clearTimeout(timeout);
    }
  }

  private formatInput(input: EmbeddingInput): string {
    if (input.type === 'query') {
      this.assertContent(input.text);
      return `task: search result | query: ${input.text}`;
    }

    this.assertContent(input.content);
    const title = input.title?.trim() || 'none';
    return `title: ${title} | text: ${input.content}`;
  }

  private assertContent(content: string): void {
    if (content.trim().length === 0) {
      throw new EmbeddingProviderError(
        'invalid_input',
        'Embedding input content must not be empty',
      );
    }
  }

  private async parseResponse(
    response: Response,
  ): Promise<OllamaEmbedResponse> {
    let payload: unknown;
    try {
      payload = await response.json();
    } catch {
      throw new EmbeddingProviderError(
        'invalid_response',
        'Embedding provider returned invalid JSON',
      );
    }

    if (
      typeof payload !== 'object' ||
      payload === null ||
      !('embeddings' in payload) ||
      !Array.isArray(payload.embeddings)
    ) {
      throw new EmbeddingProviderError(
        'invalid_response',
        'Embedding provider returned an invalid response',
      );
    }

    return { embeddings: payload.embeddings };
  }

  private toEmbeddingVector(value: unknown): EmbeddingVector {
    if (!Array.isArray(value)) {
      throw new EmbeddingProviderError(
        'invalid_response',
        `Embedding provider must return ${OLLAMA_EMBEDDING_DIMENSIONS} finite numbers per vector`,
      );
    }

    const values: unknown[] = value;
    const hasValidValues = values.every(
      (item: unknown): item is number =>
        typeof item === 'number' && Number.isFinite(item),
    );
    if (values.length !== OLLAMA_EMBEDDING_DIMENSIONS || !hasValidValues) {
      throw new EmbeddingProviderError(
        'invalid_response',
        `Embedding provider must return ${OLLAMA_EMBEDDING_DIMENSIONS} finite numbers per vector`,
      );
    }

    return {
      values,
      model: this.options.model,
      dimensions: OLLAMA_EMBEDDING_DIMENSIONS,
    };
  }
}
