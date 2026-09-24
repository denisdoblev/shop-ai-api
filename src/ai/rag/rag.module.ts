import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Product } from '../../products/entities/product.entity';
import { LlmModule } from '../llm/llm.module';
import { IngestionModule } from './ingestion/ingestion.module';
import { RagService } from './rag.service';
import { RetrievalModule } from './retrieval/retrieval.module';

@Module({
  imports: [
    ConfigModule,
    TypeOrmModule.forFeature([Product]),
    IngestionModule,
    RetrievalModule,
    LlmModule,
  ],
  providers: [RagService],
  exports: [IngestionModule, RagService],
})
export class RagModule {}
