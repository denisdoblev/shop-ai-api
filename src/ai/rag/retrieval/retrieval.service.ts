import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EMBEDDING_DIMENSIONS } from '../embeddings/embedding.constants';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { RagDocumentStatus } from '../entities/rag-document-status.enum';
import { RagChunk } from '../entities/rag-chunk.entity';

export interface RetrievedChunk {
  id: string;
  documentId: string;
  productId: string;
  content: string;
  chunkIndex: number;
  metadata: Record<string, unknown>;
  similarity: number;
}

interface RawRetrievedChunk extends Omit<RetrievedChunk, 'similarity'> {
  similarity: number | string;
}

export interface RetrievalOptions {
  topK: number;
  productId?: string;
}

@Injectable()
export class RetrievalService {
  constructor(
    private readonly embeddingsService: EmbeddingsService,
    @InjectRepository(RagChunk)
    private readonly chunkRepository: Repository<RagChunk>,
  ) {}

  async retrieve(
    query: string,
    options: RetrievalOptions,
  ): Promise<RetrievedChunk[]> {
    if (!Number.isInteger(options.topK) || options.topK <= 0) {
      throw new RangeError('topK must be a positive integer');
    }

    const queryEmbedding = await this.embeddingsService.embedQuery(query);
    if (
      queryEmbedding.dimensions !== EMBEDDING_DIMENSIONS ||
      queryEmbedding.values.length !== EMBEDDING_DIMENSIONS
    ) {
      throw new Error(
        `Query embedding must have ${EMBEDDING_DIMENSIONS} dimensions`,
      );
    }

    const productFilter =
      options.productId === undefined ? '' : 'AND document.product_id = $4';
    const parameters: Array<string | number> = [
      this.toVectorLiteral(queryEmbedding.values),
      queryEmbedding.model,
      options.topK,
    ];
    if (options.productId !== undefined) {
      parameters.push(options.productId);
    }

    const rows = await this.chunkRepository.query<RawRetrievedChunk[]>(
      `
        SELECT
          chunk.id AS "id",
          chunk.document_id AS "documentId",
          document.product_id AS "productId",
          chunk.content AS "content",
          chunk.chunk_index AS "chunkIndex",
          chunk.metadata AS "metadata",
          1 - (chunk.embedding <=> $1::vector) AS "similarity"
        FROM rag_chunks chunk
        INNER JOIN rag_documents document ON document.id = chunk.document_id
        INNER JOIN products product ON product.id = document.product_id
        WHERE chunk.deleted_at IS NULL
          AND document.deleted_at IS NULL
          AND product.deleted_at IS NULL
          AND document.status = '${RagDocumentStatus.READY}'
          AND chunk.embedding IS NOT NULL
          AND chunk.embedding_model = $2
          ${productFilter}
        ORDER BY chunk.embedding <=> $1::vector ASC, chunk.id ASC
        LIMIT $3
      `,
      parameters,
    );

    return rows.map((row) => ({
      ...row,
      similarity: Number(row.similarity),
    }));
  }

  private toVectorLiteral(values: number[]): string {
    return `[${values.join(',')}]`;
  }
}
