export const EMBEDDING_PROVIDER = Symbol('EMBEDDING_PROVIDER');

export type EmbeddingInput =
  | {
      type: 'query';
      text: string;
    }
  | {
      type: 'document';
      content: string;
      title?: string;
    };

export interface EmbeddingVector {
  values: number[];
  model: string;
  dimensions: number;
}

export interface EmbeddingProvider {
  embed(inputs: EmbeddingInput[]): Promise<EmbeddingVector[]>;
}
