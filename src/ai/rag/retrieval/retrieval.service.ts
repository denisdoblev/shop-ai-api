import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { EMBEDDING_DIMENSIONS } from '../embeddings/embedding.constants';
import { EmbeddingsService } from '../embeddings/embeddings.service';
import { RagDocumentStatus } from '../entities/rag-document-status.enum';
import { RagChunk } from '../entities/rag-chunk.entity';

export interface RagContextChunk {
  id: string;
  documentId: string;
  documentName: string;
  productId: string;
  content: string;
  chunkIndex: number;
  pageStart: number | null;
  pageEnd: number | null;
  section: string | null;
  metadata: Record<string, unknown>;
}

export interface RetrievedChunk extends RagContextChunk {
  similarity: number;
}

interface RawRetrievedChunk extends Omit<RetrievedChunk, 'similarity'> {
  similarity: number | string;
}

export interface LexicalRetrievedChunk extends RagContextChunk {
  lexicalScore: number;
}

interface RawLexicalRetrievedChunk extends Omit<
  LexicalRetrievedChunk,
  'lexicalScore'
> {
  lexicalScore: number | string;
}

export interface RetrievalOptions {
  topK: number;
  productId?: string;
}

export type LexicalRetrievalOptions = Pick<RetrievalOptions, 'productId'>;

const SPANISH_INTERROGATIVES = new Set([
  'que',
  'cual',
  'cuales',
  'cuanto',
  'cuanta',
  'cuantos',
  'cuantas',
  'cuan',
  'como',
  'donde',
  'adonde',
  'cuando',
  'quien',
  'quienes',
]);

export function normalizeLexicalQuestion(question: string): string | null {
  const terms = question
    .replace(/[¿?¡!]/gu, ' ')
    .split(/\s+/u)
    .filter((term) => term.length > 0)
    .filter(
      (term) => !SPANISH_INTERROGATIVES.has(normalizeForComparison(term)),
    );
  const normalized = terms.join(' ');

  return normalized.length === 0 ? null : normalized;
}

function normalizeForComparison(term: string): string {
  return term.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es');
}

@Injectable()
export class RetrievalService {
  constructor(
    private readonly embeddingsService: EmbeddingsService,
    @InjectRepository(RagChunk)
    private readonly chunkRepository: Repository<RagChunk>,
  ) {}

  async findBestLexicalMatch(
    question: string,
    options: LexicalRetrievalOptions = {},
  ): Promise<LexicalRetrievedChunk | null> {
    const normalizedQuestion = normalizeLexicalQuestion(question);
    if (normalizedQuestion === null) {
      return null;
    }

    const productFilter =
      options.productId === undefined ? '' : 'AND document.product_id = $2';
    const parameters =
      options.productId === undefined
        ? [normalizedQuestion]
        : [normalizedQuestion, options.productId];

    const rows = await this.chunkRepository.query<RawLexicalRetrievedChunk[]>(
      `
        WITH lexical_query AS (
          SELECT plainto_tsquery('spanish', $1) AS query
        )
        SELECT
          chunk.id AS "id",
          chunk.document_id AS "documentId",
          document.name AS "documentName",
          document.product_id AS "productId",
          chunk.content AS "content",
          chunk.chunk_index AS "chunkIndex",
          chunk.page_start AS "pageStart",
          chunk.page_end AS "pageEnd",
          chunk.section AS "section",
          chunk.metadata AS "metadata",
          ts_rank_cd(
            to_tsvector('spanish', coalesce(chunk.section, '') || ' ' || chunk.content),
            lexical_query.query
          ) AS "lexicalScore"
        FROM rag_chunks chunk
        INNER JOIN rag_documents document ON document.id = chunk.document_id
        INNER JOIN products product ON product.id = document.product_id
        CROSS JOIN lexical_query
        WHERE chunk.deleted_at IS NULL
          AND document.deleted_at IS NULL
          AND product.deleted_at IS NULL
          AND document.status = '${RagDocumentStatus.READY}'
          AND to_tsvector('spanish', coalesce(chunk.section, '') || ' ' || chunk.content)
            @@ lexical_query.query
          ${productFilter}
        ORDER BY "lexicalScore" DESC, char_length(chunk.content) ASC, chunk.id ASC
        LIMIT 1
      `,
      parameters,
    );

    const row = rows[0];
    return row === undefined
      ? null
      : { ...row, lexicalScore: Number(row.lexicalScore) };
  }

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
          document.name AS "documentName",
          document.product_id AS "productId",
          chunk.content AS "content",
          chunk.chunk_index AS "chunkIndex",
          chunk.page_start AS "pageStart",
          chunk.page_end AS "pageEnd",
          chunk.section AS "section",
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
