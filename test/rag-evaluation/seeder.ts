import { INestApplication } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { DataSource } from 'typeorm';
import { EmbeddingsService } from '../../src/ai/rag/embeddings/embeddings.service';
import { RagChunk } from '../../src/ai/rag/entities/rag-chunk.entity';
import { RagDocumentSourceType } from '../../src/ai/rag/entities/rag-document-source-type.enum';
import { RagDocumentStatus } from '../../src/ai/rag/entities/rag-document-status.enum';
import { RagDocument } from '../../src/ai/rag/entities/rag-document.entity';
import { Brand } from '../../src/brands/entities/brand.entity';
import { Category } from '../../src/categories/entities/category.entity';
import { Product } from '../../src/products/entities/product.entity';
import type { RagEvaluationDataset, SeededRagEvaluationCorpus } from './types';

export async function seedRagEvaluationCorpus(
  app: INestApplication,
  dataset: RagEvaluationDataset,
): Promise<SeededRagEvaluationCorpus> {
  const dataSource = app.get(DataSource);
  const embeddingsService = app.get(EmbeddingsService);
  const brand = await dataSource.getRepository(Brand).save({
    name: 'RAG Evaluation Fixtures',
    slug: 'rag-evaluation-fixtures',
  });
  const category = await dataSource.getRepository(Category).save({
    name: 'RAG Evaluation',
    slug: 'rag-evaluation',
  });
  const productIdsByKey = new Map<string, string>();
  const chunkIdsByEvidenceKey = new Map<string, string>();
  const evidenceKeysByChunkId = new Map<string, string>();
  const observedEmbeddingModels = new Set<string>();

  for (const fixtureProduct of dataset.products) {
    const product = await dataSource.getRepository(Product).save({
      brandId: brand.id,
      categoryId: category.id,
      name: fixtureProduct.name,
      slug: fixtureProduct.slug,
    });
    productIdsByKey.set(fixtureProduct.key, product.id);

    for (const fixtureDocument of fixtureProduct.documents) {
      const document = await dataSource.getRepository(RagDocument).save({
        productId: product.id,
        name: fixtureDocument.name,
        sourceType: RagDocumentSourceType.TEXT,
        sourceUri: null,
        mimeType: 'text/plain',
        contentHash: createHash('sha256')
          .update(
            fixtureDocument.chunks.map(({ content }) => content).join('\n'),
          )
          .digest('hex'),
        status: RagDocumentStatus.READY,
        processedAt: new Date(),
        metadata: {
          ragEvaluation: true,
          documentKey: fixtureDocument.key,
          productKey: fixtureProduct.key,
        },
      });
      const embeddings = await embeddingsService.embedDocuments(
        fixtureDocument.chunks.map(({ content }) => ({
          content,
          title: fixtureDocument.name,
        })),
      );
      const chunks = await dataSource.getRepository(RagChunk).save(
        fixtureDocument.chunks.map((fixtureChunk, chunkIndex) => {
          const embedding = embeddings[chunkIndex];
          if (embedding === undefined) {
            throw new Error(
              `Embedding provider omitted evidence ${fixtureChunk.evidenceKey}`,
            );
          }
          observedEmbeddingModels.add(embedding.model);
          return {
            documentId: document.id,
            content: fixtureChunk.content,
            chunkIndex,
            pageStart: fixtureChunk.page,
            pageEnd: fixtureChunk.page,
            section: fixtureChunk.section,
            metadata: {
              ragEvaluation: true,
              evidenceKey: fixtureChunk.evidenceKey,
            },
            embedding: embedding.values,
            embeddingModel: embedding.model,
            embeddedAt: new Date(),
          };
        }),
      );
      chunks.forEach((chunk, index) => {
        const evidenceKey = fixtureDocument.chunks[index]?.evidenceKey;
        if (evidenceKey === undefined)
          throw new Error('Fixture chunk order changed');
        chunkIdsByEvidenceKey.set(evidenceKey, chunk.id);
        evidenceKeysByChunkId.set(chunk.id, evidenceKey);
      });
    }
  }

  return {
    productIdsByKey,
    chunkIdsByEvidenceKey,
    evidenceKeysByChunkId,
    observedEmbeddingModels: [...observedEmbeddingModels],
  };
}
