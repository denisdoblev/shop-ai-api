import { Inject, Injectable } from '@nestjs/common';
import { EMBEDDING_PROVIDER } from './embedding-provider.interface';
import type {
  EmbeddingProvider,
  EmbeddingVector,
} from './embedding-provider.interface';

@Injectable()
export class EmbeddingsService {
  constructor(
    @Inject(EMBEDDING_PROVIDER)
    private readonly provider: EmbeddingProvider,
  ) {}

  embedQuery(text: string): Promise<EmbeddingVector> {
    if (text.trim().length === 0) {
      return Promise.reject(new Error('Query text must not be empty'));
    }

    return this.embedSingleQuery(text);
  }

  embedDocuments(
    documents: Array<{ content: string; title?: string }>,
  ): Promise<EmbeddingVector[]> {
    if (documents.some(({ content }) => content.trim().length === 0)) {
      return Promise.reject(new Error('Document content must not be empty'));
    }

    return this.provider.embed(
      documents.map(({ content, title }) => ({
        type: 'document' as const,
        content,
        ...(title === undefined ? {} : { title }),
      })),
    );
  }

  private async embedSingleQuery(text: string): Promise<EmbeddingVector> {
    const [embedding] = await this.provider.embed([{ type: 'query', text }]);
    if (!embedding) {
      throw new Error('Embedding provider did not return a query vector');
    }
    return embedding;
  }
}
