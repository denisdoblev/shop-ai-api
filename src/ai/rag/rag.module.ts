import { Module } from '@nestjs/common';
import { IngestionModule } from './ingestion/ingestion.module';
import { RetrievalModule } from './retrieval/retrieval.module';

@Module({
  imports: [IngestionModule, RetrievalModule],
  exports: [IngestionModule],
})
export class RagModule {}
