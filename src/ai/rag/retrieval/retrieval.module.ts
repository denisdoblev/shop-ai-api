import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EmbeddingsModule } from '../embeddings/embeddings.module';
import { RagChunk } from '../entities/rag-chunk.entity';
import { RetrievalService } from './retrieval.service';

@Module({
  imports: [EmbeddingsModule, TypeOrmModule.forFeature([RagChunk])],
  providers: [RetrievalService],
  exports: [RetrievalService],
})
export class RetrievalModule {}
