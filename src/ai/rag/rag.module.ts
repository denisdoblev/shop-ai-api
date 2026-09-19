import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ChunkingModule } from './chunking/chunking.module';
import { EmbeddingsModule } from './embeddings/embeddings.module';
import { RagChunk } from './entities/rag-chunk.entity';
import { RagDocument } from './entities/rag-document.entity';
import { IngestionModule } from './ingestion/ingestion.module';
import { RetrievalModule } from './retrieval/retrieval.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([RagDocument, RagChunk]),
    IngestionModule,
    ChunkingModule,
    EmbeddingsModule,
    RetrievalModule,
  ],
})
export class RagModule {}
